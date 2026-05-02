
## 5.1 Redis 数据结构原理

> Redis 的 5 种数据类型对应 5 种底层数据结构，理解底层原理有助于选择合适的命令和优化性能。

### 5.1.1 RedisObject：数据的统一封装

Redis 中所有数据（无论 key 还是 value）都会被封装为 **RedisObject**（简称 robj）。通过同一个结构存储不同类型的数据，Redis 实现了"类型多态"。

**RedisObject 结构**：

```c
typedef struct redisObject {
    unsigned type:4;        // 数据类型（STRING/LIST/HASH/SET/ZSET）
    unsigned encoding:4;    // 底层编码方式（共11种）
    unsigned lru:LRU_BITS;  // LRU/LFU 信息
    int refcount;            // 引用计数，用于 GC
    void *ptr;              // 指向实际数据结构的指针
} robj;
```

**type 字段：5 种数据类型**

| type 值 | 类型 | 说明 |
|---|---|---|
| 0 | OBJ_STRING | 字符串 |
| 1 | OBJ_LIST | 列表 |
| 2 | OBJ_SET | 集合 |
| 3 | OBJ_ZSET | 有序集合 |
| 4 | OBJ_HASH | 哈希 |

**encoding 字段：11 种底层编码**

| encoding 值 | 编码常量 | 说明 |
|---|---|---|
| 0 | OBJ_ENCODING_RAW | SDS 动态字符串（raw） |
| 1 | OBJ_ENCODING_INT | long 整数 |
| 2 | OBJ_ENCODING_HT | 哈希表（Dict） |
| 3 | OBJ_ENCODING_ZIPMAP | 已废弃 |
| 4 | OBJ_ENCODING_LINKEDLIST | 双端链表 |
| 5 | OBJ_ENCODING_ZIPLIST | 压缩列表 |
| 6 | OBJ_ENCODING_INTSET | 整数集合 |
| 7 | OBJ_ENCODING_SKIPLIST | 跳表 |
| 8 | OBJ_ENCODING_EMBSTR | embstr 短字符串 |
| 9 | OBJ_ENCODING_QUICKLIST | 快速列表 |
| 10 | OBJ_ENCODING_STREAM | Stream 流 |

**5 种数据类型与底层编码的对应关系**

| 数据类型 | 编码方式 | 说明 |
|---|---|---|
| STRING | int / embstr / raw | 整数、短字符串、长字符串 |
| LIST | quicklist | Redis 3.2+ 统一用 QuickList |
| SET | intset / hashtable | 纯整数用数组，其他用 Dict |
| ZSET | ziplist / skiplist | 小数据量用压缩列表，否则跳表+Dict |
| HASH | ziplist / hashtable | 小数据量用压缩列表，否则 Dict |

> **贴心提示**：`OBJECT ENCODING <key>` 命令可以查看任意 key 的底层编码。理解了 RedisObject 和编码对应关系，就能明白为什么某些操作会变快或变慢。

### 5.1.2 String 的底层实现：SDS（动态字符串）

Redis 默认的字符串实现，不是 C 语言原生字符串（`char*`），而是自定义的 **SDS（Simple Dynamic String）**。

**SDS 结构**（Redis 5.0）：

为了极致节省内存，SDS 根据字符串长度自动选择不同的 Header 结构，共 5 种：

```c
struct __attribute__ ((__packed__)) sdshdr5 {
    unsigned char flags; // 低3位存储类型，高5位存储长度
    char buf[];          // 实际存储字符串的数组
};
struct __attribute__ ((__packed__)) sdshdr8 {
    uint8_t len;         // 已用长度
    uint8_t alloc;       // 总容量（不含头和结尾\0）
    unsigned char flags; // 类型
    char buf[];          // 实际字符串
};
struct __attribute__ ((__packed__)) sdshdr16 {
    uint16_t len;        // 已用长度
    uint16_t alloc;      // 总容量
    unsigned char flags;
    char buf[];
};
struct __attribute__ ((__packed__)) sdshdr32 {
    uint32_t len;
    uint32_t alloc;
    unsigned char flags;
    char buf[];
};
struct __attribute__ ((__packed__)) sdshdr64 {
    uint64_t len;
    uint64_t alloc;
    unsigned char flags;
    char buf[];
};
```

**类型选择规则**：

| SDS 类型 | 长度字段 | 适用字符串长度 |
|---|---|---|
| sdshdr5 | 1 字节 | < 32 字节 |
| sdshdr8 | 1 字节 | 32~255 字节 |
| sdshdr16 | 2 字节 | 256~65535 字节 |
| sdshdr32 | 4 字节 | 65536~4294967295 字节 |
| sdshdr64 | 8 字节 | > 4GB |

Redis 自动根据字符串长度选择最紧凑的 Header，**不会混用**。

**SDS vs C 字符串的优势**：
- `strlen` 是 O(1)（SDS 记录了 len）
- 杜绝缓冲区溢出（C 字符串不记录长度，可能溢出）
- 减少修改时的内存重分配（空间预分配 + 惰性空间释放）
- 二进制安全（SDS 通过 len 判断结尾，不依赖 `\0`）

### 5.1.3 Set 的底层实现：IntSet（整数数组）

当 Set 集合**同时满足**以下两个条件时，Redis 使用 IntSet 存储：
1. 所有元素都是整数
2. 元素数量不超过 512（默认，`set-max-intset-entries` 可配置）

只要有一个条件不满足，就会自动转换为 Dict（Hashtable）。

**结构**：

```c
typedef struct intset {
    uint32_t encoding;  // 编码方式：INTSET_ENC_INT16/32/64
    uint32_t length;    // 元素个数
    int8_t contents[];  // 元素数组
} intset;
```

**查询方式**：二分查找，时间复杂度 O(log n)。

**升级**：当向 IntSet 添加一个新元素，且新元素类型比现有类型更长时，IntSet 会自动升级（先扩容，再逐个转换旧元素，最后添加新元素）。**不支持降级**。

### 5.1.4 通用底层结构：Dict（字典/哈希表）

当 Set 集合包含非整数元素，或元素个数超过 `set-max-intset-entries` 阈值（默认512）时，Redis 使用 Dict（哈希表）实现。

**Dict 结构**：

```c
typedef struct dict {
    dictType *type;      // 类型特定函数
    void *privdata;      // 私有数据
    dictht ht[2];        // 两张哈希表（用于 rehash）
    long rehashidx;      // rehash 进度，-1 表示未在 rehash
    long long pauserehash; // 暂停 rehash 标识
} dict;

typedef struct dictht {
    dictEntry **table;   // 哈希表数组
    unsigned long size;  // 哈希表大小
    unsigned long sizemask; // 掩码 = size-1，用于计算索引
    unsigned long used;  // 已使用的节点数
} dictht;

typedef struct dictEntry {
    void *key;           // 键
    union {              // 值（可以是多种类型）
        void *val;
        uint64_t u64;
        int64_t s64;
        double d;
    } v;
    struct dictEntry *next; // 指向下一个节点的指针（拉链法解决哈希冲突）
} dictEntry;
```

**渐进式 rehash**：当哈希表需要扩容或缩容时，Redis 不是一次性完成（会阻塞），而是分多次、渐进式地将 ht[0] 的数据迁移到 ht[1]。

### 5.1.5 Hash/List/ZSet 的底层实现：ZipList（压缩列表）

当 Hash/List/SortedSet 的数据量较小时，Redis 使用 ZipList（压缩列表）存储，以节省内存。

**ZipList 结构**：

```
zlbytes(4) | zltail(4) | zllen(2) | entry1 | entry2 | ... | entryN | zlend(1)
```

- `zlbytes`：整个压缩列表的字节数
- `zltoff`：最后一个节点的偏移量（方便从尾部遍历）
- `zllen`：节点数量
- `entry`：每个数据节点，结构为 `<prevlen><encoding><content>`
  - `prevlen`：前一个节点的长度（支持从后往前遍历）
  - `encoding`：编码方式（决定 content 类型）
  - `content`：实际内容
- `zlend`：固定为 0xFF，表示列表结束

**缺点**：每次插入/删除元素都可能触发连锁更新（后面的 entry 的 prevlen 字段需要重新分配），最坏 O(n²)。

**ZipList 连锁更新详解**

ZipList 的每个 entry 都包含 `prevlen` 字段记录前一个节点的大小：
- 若前一个节点长度 < 254 字节，`prevlen` 用 **1 字节**存储
- 若前一个节点长度 ≥ 254 字节，`prevlen` 用 **5 字节**存储（首字节为 0xFE，后 4 字节为真实长度）

假设有 N 个连续 entry，每个 entry 的长度恰好在 250~253 字节之间，此时每个 `prevlen` 只需要 1 字节即可表示。如果在列表**头部**插入一个新 entry，导致原第一个 entry 的长度从 252 变为 253 字节，`prevlen` 仍需 1 字节，无需更新。

但如果在列表**中间**插入一个新 entry，使某个 entry 的长度超过 254 字节，它的 `prevlen` 需要从 1 字节扩展为 5 字节。这个 entry 长度的变化又会导致它后面所有 entry 的 `prevlen` 也需要扩展，以此类推，形成**连锁更新**：原本只插入一个 entry，却触发了 O(n) 次 entry 空间的重新分配，最坏情况下复杂度为 O(n²)。

> **贴心提示**：连锁更新虽然最坏复杂度高，但**触发条件苛刻**——只有当所有 entry 长度都在 250~253 字节之间才会引发大规模连锁更新。实际生产中 entry 大小通常差异较大，连锁更新影响有限。Redis 通过限制 ZipList 最大长度来规避这一风险（QuickList 就是为解决这个问题而设计的）。

### 5.1.6 List 的底层实现：QuickList（快速列表）

Redis 3.2 之后，List 的底层实现由 ZipList 改为 QuickList（双向链表 + 多个 ZipList）。

**QuickList 结构**：

```
head(ZipList) <-> ZipList <-> ZipList <-> ZipList <-> tail(ZipList)
```

每个 ZipList 默认最多存储 8KB 数据，超过则分裂为两个 ZipList。兼顾了 ZipList 的内存效率和普通链表的插入/删除效率。

### 5.1.7 ZSet 的底层实现：SkipList（跳表）

SortedSet 的底层实现是 **SkipList + Dict**：
- Dict 负责记录 `member -> score` 的映射（O(1) 查询）
- SkipList 负责按 score 排序和范围查询

**SkipList 原理**：
SkipList 是多层有序链表，最底层是普通有序链表。上层链表是下层的"快速通道"，可以跳过部分节点。

```
Level 2:  ---->  node3 ---->  node7 ---->  null
Level 1:  ---->  node1 ---->  node3 ---->  node5 ---->  node7 ---->  null
Level 0:  node1 ---->  node2 ---->  node3 ---->  node4 ---->  node5 ---->  node6 ---->  node7 ---->  null
```

查找时从高层开始，逐层往下跳，复杂度 O(log n)。

> **为什么 SortedSet 不直接用平衡树而用跳表？**
> - 跳表实现比平衡树简单，插入/删除不需要旋转操作
> - 跳表的区间查询性能更好（平衡树需要中序遍历）
> - Redis 作者 Antirez 认为跳表更易于理解和调试

## 5.2 Redis 网络模型

### 5.2.1 IO 模型基础（阻塞 / 非阻塞 / 多路复用）

**用户空间与内核空间**

应用程序（如 Redis）无法直接访问计算机硬件，必须通过操作系统内核来操作。以 Linux 为例，进程的寻址空间划分为两部分：
- **用户空间**（Ring 3）：用户进程只能执行受限命令，不能直接调用系统资源，必须通过内核提供的接口访问
- **内核空间**（Ring 0）：可以执行特权命令，调用一切系统资源

为了减少磁盘 IO 等待时间，Linux 在用户空间和内核空间都加入了缓冲区：
- **写数据时**：用户缓冲区 → 内核缓冲区 → 写入设备
- **读数据时**：设备 → 内核缓冲区 → 拷贝到用户缓冲区

整个过程涉及两次数据拷贝，性能开销主要在等待和数据搬运上。

**阻塞 IO（Blocking IO）**

应用进程调用 `recvfrom` 读取数据，在两个阶段都必须阻塞等待：
- **阶段一**：数据尚未到达内核，内核等待数据就绪，用户进程阻塞
- **阶段二**：数据到达并拷贝到内核缓冲区，再拷贝到用户缓冲区，用户进程在拷贝过程中依然阻塞

特点：**两个阶段全程阻塞**。

**非阻塞 IO（Non-blocking IO）**

`recvfrom` 调用后**立即返回**，而非阻塞等待：
- **阶段一**：数据未就绪时，返回 `EAGAIN` 错误；用户进程收到错误后不断轮询尝试，CPU 空转
- **阶段二**：数据就绪后，执行与阻塞 IO 相同的拷贝过程

特点：**第一阶段不阻塞，但 CPU 忙等；第二阶段依然阻塞**。性能并未提升，反而可能更差。

**IO 多路复用（IO Multiplexing）**

无论是阻塞 IO 还是非阻塞 IO，每个 socket 读操作都对应一次系统调用。当并发连接数很大时，频繁的系统调用成为瓶颈。

IO 多路复用的核心思想：**用一个线程监听多个 socket，当某个 socket 就绪时才调用 `recvfrom` 读取数据**。

这就好比餐厅点餐：
- 普通 IO：顾客想一道菜就叫服务员，**没想好就干等**，效率低
- 多路复用：顾客**想好了再叫**服务员，服务员同时服务多个已就绪的顾客，效率高

Redis 正是基于这一思路，用单线程 + IO 多路复用实现了高并发。

### 5.2.2 IO 多路复用实现（select / poll / epoll）

IO 多路复用的监听机制有多种实现，常见三种：

#### select

最早的 IO 多路复用实现：
1. 用户态创建 fd_set（固定大小 1024 位），标记要监听的 socket
2. 调用 `select()` 将 fd_set 拷贝到内核，内核遍历检查哪些 socket 就绪
3. 无 socket 就绪时内核休眠，有 socket 就绪时被唤醒
4. 内核将 fd_set 拷贝回用户态，**用户态再次遍历 fd_set** 找到就绪的 socket
5. 对就绪的 socket 调用 `recvfrom` 读取数据

**三个主要问题**：
- fd_set 最大 1024，监听数量受限
- 每次调用都要把**整个 fd 集合**拷贝到内核
- 用户态拿到结果后要**遍历所有 FD** 才能找到就绪的 socket

#### poll

对 select 做了简单改进：用链表替代固定位图，解决了 FD 上限问题（链表理论上无上限）。但核心问题——每次都要把全部监听 FD 传给内核、每次都要遍历全部 FD 判断就绪——依然存在。

#### epoll（Linux 生产环境推荐）

epoll 引入红黑树和就绪链表，完美解决了 select/poll 的三个问题：

**核心结构**：
- **红黑树**（rb_root）：记录要监听的 FD，O(log n) 增删查
- **就绪链表**（list_head）：记录已就绪的 FD，回调机制自动添加，无需遍历

**三个关键函数**：
- `epoll_create()`：创建 epoll 实例（红黑树 + 空链表）
- `epoll_ctl(fd, ADD/MOD/DEL)`：将 socket 添加到红黑树，并注册回调函数（socket 就绪时自动把 FD 追加到就绪链表）
- `epoll_wait()`：等待并返回就绪链表中的 FD（可设置超时时间）

**epoll 如何解决 select/poll 的问题**：
- 红黑树存储 FD，**无数量上限**，增删效率高
- 每个 FD 只在 `epoll_ctl` 时传入一次内核，**无需重复拷贝**
- 就绪时回调函数直接将 FD 写入链表，**无需遍历所有 FD**

#### epoll 的两种通知模式：ET 和 LT

- **LT（Level Triggered，水平触发）**：只要 FD 中有数据，每次调用 `epoll_wait` 都会通知。默认模式。
- **ET（Edge Triggered，边沿触发）**：只有当 FD 状态**发生变化**时（如从无数据变为有数据）才通知一次，之后即使数据未读完也不再通知。

> **贴心提示**：ET 模式效率更高，但要求应用程序一次性读取所有就绪数据，否则会漏掉数据（因为不会再收到通知）。Redis 使用的是 LT 模式，代码更简单。

#### 信号驱动 IO

与内核建立 SIGIO 信号关联，**数据就绪时内核主动发信号通知用户**，用户进程无需阻塞等待。
- **阶段一**：注册信号处理函数 → 内核开始监听 → 用户进程执行其他业务 → 内核发 SIGIO 通知
- **阶段二**：收到信号 → 调用 `recvfrom` 读取数据 → 内核拷贝数据到用户空间 → 处理数据

缺点：大量 IO 操作时信号频繁，SIGIO 处理函数可能来不及处理导致队列溢出，内核与用户空间频繁信号交互性能也不佳。

#### 异步 IO（AIO）

真正的"无需等待"模型：
- 用户进程发起 `aio_read` 后**立即返回**，内核全权负责数据准备和拷贝
- 内核完成所有操作后，才通知用户进程数据已可用

特点：**两个阶段都不阻塞，全部由内核完成**。性能最高，但实现复杂，Linux 下的 AIO 支持不够完善。

#### 五种 IO 模型对比

| 模型 | 阶段一等待 | 阶段二拷贝 | 优点 | 缺点 |
|---|---|---|---|---|
| 阻塞 IO | 阻塞 | 阻塞 | 简单 | 全程阻塞，效率低 |
| 非阻塞 IO | 非阻塞（轮询） | 阻塞 | 阶段一不等待 | CPU 忙等，性能差 |
| IO 多路复用 | 阻塞（单线程等多个） | 阻塞 | 单线程处理大量并发 | 两阶段都阻塞 |
| 信号驱动 | 非阻塞（信号通知） | 阻塞 | 阶段一不等待 | 信号过多时性能下降 |
| 异步 IO | 非阻塞 | 非阻塞 | 完全异步，性能最高 | 实现复杂 |

> **与 Redis 的关系**：Redis 核心网络模型在 6.0 之前完全基于 epoll（IO 多路复用）+ 单线程实现，充分利用了 IO 多路复用高效等待的优势，弥补了"两个阶段都阻塞"的不足——因为 Redis 处理每个命令极快（纯内存操作），阻塞时间几乎可以忽略。

### 5.2.3 Redis 事件循环

Redis 将每个 socket 都注册到 IO 多路复用器中，由单线程顺序处理所有事件：

```
┌─────────────────────┐
│   事件循环（单线程）  │
│                     │
│  while (true) {     │
│    ① 轮询就绪事件     │──────> 处理命令
│    ② 处理文件事件    │──────> 读请求、解析、执行、响应
│    ③ 处理时间事件    │──────> 键过期检查、持久化触发
│  }                   │
└─────────────────────┘
```

- **文件事件**：客户端命令请求、响应数据
- **时间事件**：定时任务，如过期键删除（惰性删除 + 定期删除）

### 5.2.4 Redis 单线程与多线程演进

**Redis 是单线程还是多线程？**

从不同角度看，答案不同：
- **核心命令处理**（命令解析、执行、返回）：**单线程**
- **整体 Redis 进程**：**多线程**（持久化、子进程等后台任务）

**两个关键版本**：
- **Redis v4.0**（2017）：引入多线程用于异步处理**耗时操作**，例如 `UNLINK`（非阻塞删除，比 `DEL` 快得多）
- **Redis v6.0**（2020）：在核心网络模型中引入 **IO 多线程**，将 socket 读取、命令解析等 IO 操作交给多线程并行处理，命令执行仍由主线程负责

**为什么核心命令用单线程？**

1. **性能瓶颈不在 CPU，在 IO**：Redis 是纯内存操作，执行速度极快（纳秒级），主要延迟来自网络 IO，单线程已经足够快，多线程不会带来显著提升
2. **避免上下文切换开销**：线程切换需要保存/恢复寄存器、堆栈等，多线程反而增加开销
3. **避免线程安全问题**：多线程需要加锁（互斥量、读写锁），引入锁竞争反而降低性能，单线程天然无锁，安全简单

**Redis 6.0 的 IO 多线程模型**：

```
主线程（命令执行）
  ↑
  ↓ IO线程（读取/解析）并行处理多个socket
  ↑
客户端请求 → socket → epoll监听 → IO线程读取 → 命令入队 → 主线程执行
```

注意：Redis 6.0 的 IO 多线程**默认是关闭**的，需要在配置文件中开启：
```properties
io-threads-do-reads yes
io-threads 6
```

> **贴心提示**：即使开启了 IO 多线程，Redis 的**核心业务逻辑（命令执行）仍然是单线程**的，所以不存在线程安全问题。多线程只是加速了 IO 阶段（读取请求、解析命令、返回响应）。

### 5.2.5 RESP 协议

Redis 与客户端之间使用 **RESP（REdis Serialization Protocol）** 协议通信。RESP 是文本协议，目前有两个主要版本：

| 版本 | 引入时间 | 说明 |
|---|---|---|
| RESP2 | Redis 2.0 | 经典版本，支持 5 种基本数据类型 |
| RESP3 | Redis 6.0 | 超集，新增 9 种数据类型，支持服务端推送 |

**RESP2 数据类型**（5种）：
- `+`：简单字符串（Simple String），如 `+OK\r\n`
- `-`：错误（Error），如 `-ERR unknown command 'foo'\r\n`
- `:`：整数（Integer），如 `:1000\r\n`
- `$`：批量字符串（Bulk String），如 `$5\r\nhello\r\n`
- `*`：数组（Array），如 `*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n`

**RESP3 新增数据类型**（9种）：
- `_`：空值（Null）
- `#`：布尔值（`#t\r\n` / `#f\r\n`）
- `,`：双精度浮点数（Double）
- `(`：大数（Big Number，超出64位整数范围）
- `!`：批量错误（Bulk Error）
- `=`：逐字字符串（Verbatim String，原样保留）
- `%`：映射（Map，键值对集合）
- `~`：集合（Set，无序唯一元素）
- `>`：推送（Push，服务端主动推送带外数据）

> **贴心提示**：Spring Data Redis 默认使用 RESP2。RESP3 的主要价值在于支持服务端推送（如 Pub/Sub、Stream 的实时事件），普通业务场景用 RESP2 足够了。

**RESP 消息格式示例**（以 RESP2 为例）：

```
*<参数个数>\r\n
$<参数1字节数>\r\n
<参数1>\r\n
$<参数2字节数>\r\n
<参数2>\r\n
...
```

客户端发送 `SET name Jack` 的二进制格式：

```
*3\r\n
$3\r\n
SET\r\n
$4\r\n
name\r\n
$4\r\n
Jack\r\n
```

**实战练习：基于 Socket 实现 Redis 客户端**

Redis 支持标准 TCP 通信，可以直接用 Socket 模拟客户端发送 RESP 协议命令：

```java
import java.io.*;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class RedisClient {

    static Socket socket;
    static PrintWriter writer;
    static BufferedReader reader;

    public static void main(String[] args) throws IOException {
        // 1. 建立 TCP 连接
        socket = new Socket("127.0.0.1", 6379);
        writer = new PrintWriter(
            new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8)
        );
        reader = new BufferedReader(
            new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8)
        );

        // 2. 发送命令（SET name Jack）
        sendRequest("SET", "name", "Jack");
        System.out.println("响应: " + handleResponse());

        // 3. 发送命令（GET name）
        sendRequest("GET", "name");
        System.out.println("响应: " + handleResponse());

        // 4. 发送命令（INCR counter）
        sendRequest("INCR", "counter");
        System.out.println("响应: " + handleResponse());

        socket.close();
    }

    /**
     * 按照 RESP 协议格式发送命令
     * 例如：SET name Jack -> *3\r\n$3\r\nSET\r\n$4\r\nname\r\n$4\r\nJack\r\n
     */
    private static void sendRequest(String... args) {
        writer.println("*" + args.length);  // 参数个数
        for (String arg : args) {
            byte[] bytes = arg.getBytes(StandardCharsets.UTF_8);
            writer.println("$" + bytes.length);  // 参数字节长度
            writer.println(arg);                  // 参数内容
        }
        writer.flush();
    }

    /**
     * 按照 RESP 协议格式解析响应
     */
    private static Object handleResponse() throws IOException {
        int prefix = reader.read();  // 读取首字节判断类型

        switch (prefix) {
            case '+':  // 单行字符串
                return reader.readLine();
            case '-':  // 错误信息
                throw new RuntimeException(reader.readLine());
            case ':':  // 整数
                return Long.parseLong(reader.readLine());
            case '$':  // 批量字符串
                int len = Integer.parseInt(reader.readLine());
                if (len == -1) return null;   // nil
                if (len == 0)  return "";     // 空字符串
                return reader.readLine();      // 读 len 个字节（简化：按行读）
            case '*':  // 数组
                return readBulkString();
            default:
                throw new RuntimeException("不支持的数据格式，首字节: " + (char) prefix);
        }
    }

    private static Object readBulkString() throws IOException {
        int size = Integer.parseInt(reader.readLine());
        if (size <= 0) return null;
        List<Object> list = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            list.add(handleResponse());
        }
        return list;
    }
}
```

> **贴心提示**：理解 RESP 协议有助于排查 Redis 客户端问题。如果发现连接失败，可以 telnet 到 Redis 端口直接发送 RESP 格式命令进行调试。

## 5.3 Redis 内存回收

### 5.3.1 过期 key 删除策略

Redis 会维护一个过期字典（expire dict），记录每个 key 的过期时间。有两种删除策略：

**策略一：惰性删除**

每次访问 key 时检查是否过期，过期则删除。
- 优点：对 CPU 友好，只在访问时检查
- 缺点：过期 key 较多时，内存占用大

**策略二：定期删除**

每隔一段时间随机检查一批设置了过期时间的 key，删除其中过期的。Redis 同时实现了两种定期删除模式：

**SLOW 模式**：
- 由 Redis 服务初始化时注册定时任务，按 `server.hz` 频率执行（默认 **10 次/秒**，即每 100ms 执行一轮）
- 每轮耗时**不超过 25ms**（默认 `slowhz=10`，即 100ms × 25% = 25ms）
- 每轮检查：遍历 db 的各个 bucket，随机抽取 20 个 key 判断是否过期
- 如果未超过时间上限**且过期 key 比例 > 10%**，继续抽样下一批；否则结束

**FAST 模式**：
- 在每个事件循环前调用 `beforeSleep()` 时执行
- 相邻两次 FAST 模式执行**间隔不低于 2ms**
- 每轮耗时**不超过 1ms**
- 检查逻辑与 SLOW 相同，但如果过期 key 比例 < 10%，则直接跳过不执行

**实际使用**：Redis 同时使用惰性删除 + 定期删除，两者配合保证内存和CPU的平衡。

> **贴心提示**：SLOW 模式的执行频率由 `hz` 参数控制，`hz` 越大清理越及时但 CPU 消耗也越大；`hz` 越小越省 CPU 但过期 key 堆积可能更多。对于内存敏感的业务，建议 `hz` 设置在 10~100 之间。

### 5.3.2 内存淘汰策略

当 Redis 内存使用达到上限（`maxmemory`）时，需要主动淘汰一些 key。

**6种淘汰策略**：

| 策略 | 说明 |
|---|---|
| `noeviction` | 不淘汰，返回错误（默认） |
| `volatile-lru` | 从设置了过期时间的 key 中淘汰最少使用的 |
| `volatile-lfu` | 从设置了过期时间的 key 中淘汰使用频率最低的 |
| `volatile-ttl` | 从设置了过期时间的 key 中淘汰最早过期的 |
| `volatile-random` | 从设置了过期时间的 key 中随机淘汰 |
| `allkeys-lru` | 从所有 key 中淘汰最少使用的（推荐） |
| `allkeys-lfu` | 从所有 key 中淘汰使用频率最低的 |
| `allkeys-random` | 从所有 key 中随机淘汰 |

> **生产建议**：如果业务对所有数据都有冷热区分，推荐 `allkeys-lru`；如果只是部分数据有过期需求，推荐 `volatile-lru`。

**LFU 计数器运算规则**

LFU（Least Frequently Used）会统计每个 key 的访问频率，频率越低越容易被淘汰。但 Redis 中的访问次数并不是每访问一次就 +1，而是通过**概率性递增**实现：

**递增规则**（Morris 概率计数器）：

Redis 使用一种近似算法——Morris 计数器，每次访问并不是 +1，而是按概率增长：

1. 生成随机数 R ∈ [0, 1)
2. 递增概率 = `1 / (counter × lfu_log_factor + 1)`
3. 如果 `R < 该概率`，则计数器 +1；否则不变
4. 计数器上限为 **255**

由于 counter 越大，分母越大，概率越小，所以计数器呈**对数增长**——前期增长快，后期越来越慢。

| lfu_log_factor | ~100次访问后计数器≈ | ~1M次访问后计数器≈ |
|---|---|---|
| 1 | ~18 | ~64 |
| 10（默认） | ~10 | ~142 |
| 100 | ~8 | ~49 |

**衰减规则**：

LFU 采样评估 key 时，检查距上次访问经过了多少分钟，每经过 `lfu_decay_time` 分钟（默认 1 分钟），计数器 -1。

- `lfu_decay_time = 1`：5 分钟未访问，计数器 -5
- `lfu_decay_time = 0`：**永不衰减**
- 计数器最小为 0

> **贴心提示**：lfu_log_factor 越大，对访问频率的"记忆"越持久；lfu_decay_time 越大，频率衰减越慢。合理调优这两个参数，可以让 LRU/LFU 更准确地反映数据的冷热程度。

---

