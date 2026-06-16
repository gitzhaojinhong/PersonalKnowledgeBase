## 三、条件构造器 Wrapper

### 3.1 Wrapper 体系概述

**Wrapper** 是 MyBatis-Plus 用于构造动态 SQL 条件的核心对象。整个 Wrapper 体系如下：

```
AbstractWrapper
    ├── QueryWrapper              (普通查询条件)
    ├── UpdateWrapper             (普通更新条件)
    ├── AbstractLambdaWrapper
    │       ├── LambdaQueryWrapper      (Lambda 查询条件，类型安全)
    │       ├── LambdaUpdateWrapper     (Lambda 更新条件，类型安全)
    │       └── LambdaDeleteWrapper     (Lambda 删除条件，Db.remove 场景)
    └── 链式 Wrapper（IService 层封装，内部委托上述 Wrapper，非 AbstractWrapper 子类）
            ├── QueryChainWrapper              (普通链式查询)
            ├── LambdaQueryChainWrapper        (Lambda 链式查询)
            ├── UpdateChainWrapper             (普通链式更新)
            └── LambdaUpdateChainWrapper       (Lambda 链式更新)
```

**选择建议**：
- **简单场景/字段名固定**：使用 `QueryWrapper` / `UpdateWrapper`
- **企业开发/追求类型安全**：**强烈推荐使用 `LambdaQueryWrapper` / `LambdaUpdateWrapper`**
- **Service 层快速操作**：使用 `lambdaQuery()` / `lambdaUpdate()` 链式调用
- **Kotlin 项目**：使用 `KtQueryWrapper` / `KtUpdateWrapper`（Lambda 链式不直接支持）

### 3.2 AbstractWrapper 核心方法

#### 3.2.1 比较运算

| 方法 | 说明 | 示例（Lambda 风格） |
|------|------|-------------------|
| `eq` | 等于 `=` | `.eq(User::getAge, 18)` |
| `ne` | 不等于 `<>` | `.ne(User::getStatus, 0)` |
| `gt` | 大于 `>` | `.gt(User::getAge, 18)` |
| `ge` | 大于等于 `>=` | `.ge(User::getAge, 18)` |
| `lt` | 小于 `<` | `.lt(User::getAge, 60)` |
| `le` | 小于等于 `<=` | `.le(User::getAge, 60)` |
| `between` | 范围 `BETWEEN` | `.between(User::getAge, 18, 30)` |
| `notBetween` | 不在范围 | `.notBetween(User::getAge, 0, 18)` |
| `eqSql` | 等于子查询结果 | `.eqSql(User::getId, "SELECT MAX(id) FROM t")` |
| `gtSql` | 大于子查询结果 | `.gtSql(User::getId, "SELECT id FROM t WHERE name='x'")` |
| `geSql` | 大于等于子查询结果 | `.geSql(User::getId, "SELECT id FROM t WHERE name='x'")` |
| `ltSql` | 小于子查询结果 | `.ltSql(User::getId, "SELECT id FROM t WHERE name='x'")` |
| `leSql` | 小于等于子查询结果 | `.leSql(User::getId, "SELECT id FROM t WHERE name='x'")` |

**示例**：

```java
// 查询年龄 18-30 岁之间的用户
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .between(User::getAge, 18, 30)
);

// 与子查询结果比较：查询 id 小于最大 id 的记录
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .ltSql(User::getId, "SELECT MAX(id) FROM t_user")
);
```

#### 3.2.2 模糊查询

| 方法 | 说明 | 生成 SQL |
|------|------|---------|
| `like` | 全模糊 | `LIKE '%值%'` |
| `notLike` | 全模糊取反 | `NOT LIKE '%值%'` |
| `likeLeft` | 左模糊 | `LIKE '%值'` |
| `likeRight` | 右模糊 | `LIKE '值%'` |
| `notLikeLeft` | 左模糊取反 | `NOT LIKE '%值'` |
| `notLikeRight` | 右模糊取反 | `NOT LIKE '值%'` |

**示例**：

```java
LambdaQueryWrapper<User> lqw = Wrappers.lambdaQuery();

// 全模糊：用户名包含"张"
lqw.like(User::getUsername, "张");
// SQL: WHERE username LIKE '%张%'

// 左模糊：邮箱以 @qq.com 结尾
lqw.likeLeft(User::getEmail, "@qq.com");
// SQL: WHERE email LIKE '%@qq.com'

// 右模糊：用户名以 admin 开头
lqw.likeRight(User::getUsername, "admin");
// SQL: WHERE username LIKE 'admin%'

// 取反：用户名不包含"张"
lqw.notLike(User::getUsername, "张");
// SQL: WHERE username NOT LIKE '%张%'
```

#### 3.2.3 空值判断

| 方法 | 说明 |
|------|------|
| `isNull` | `IS NULL` |
| `isNotNull` | `IS NOT NULL` |

**示例**：

```java
// 查询邮箱为空的用户
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .isNull(User::getEmail)
);

// 查询设置了年龄的用户
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .isNotNull(User::getAge)
);
```

#### 3.2.4 IN 查询

| 方法 | 说明 |
|------|------|
| `in` | `IN (...)`，支持 Collection 或可变参数 |
| `notIn` | `NOT IN (...)` |
| `inSql` | `IN` 内嵌 SQL 子查询 |
| `notInSql` | `NOT IN` 内嵌 SQL 子查询 |

**示例**：

```java
// IN：集合形式
List<Long> ids = Arrays.asList(1L, 2L, 3L);
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery().in(User::getId, ids)
);

// NOT IN：排除特定年龄
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery().notIn(User::getAge, Arrays.asList(1, 2, 3))
);

// IN 子查询：查询下过订单的用户
List<User> list3 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .inSql(User::getId, "SELECT user_id FROM t_order WHERE amount > 100")
);

// NOT IN 子查询：排除特定 id 范围
List<User> list4 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .notInSql(User::getId, "SELECT id FROM t_user WHERE status = 0")
);
```

#### 3.2.5 分组与排序

| 方法 | 说明 |
|------|------|
| `groupBy` | `GROUP BY` |
| `orderByAsc` | `ORDER BY ... ASC` |
| `orderByDesc` | `ORDER BY ... DESC` |
| `orderBy` | 自定义排序方向 |
| `having` | `HAVING` 条件 |

**示例**：

```java
// 按年龄分组统计，只保留人数 > 5 的组
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .select(User::getAge)
        .groupBy(User::getAge)
        .having("count(*) > {0}", 5)
);

// 多字段排序：先按年龄降序，再按创建时间升序
List<User> sorted = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .orderByDesc(User::getAge)
        .orderByAsc(User::getCreateTime)
);
```

#### 3.2.6 逻辑连接（AND / OR）

| 方法 | 说明 |
|------|------|
| `and(Consumer)` | AND 嵌套，括号包裹 |
| `or()` | **后续所有条件**切换为 OR（非仅下一个） |
| `or(Consumer)` | OR 嵌套，括号包裹 |
| `nested(Consumer)` | 正常嵌套（AND），括号包裹 |

**示例**：

```java
// 复杂条件：(username = '张三' AND age > 18) OR (username = '李四' AND age < 30)
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .and(qw -> qw.eq(User::getUsername, "张三").gt(User::getAge, 18))
        .or(qw -> qw.eq(User::getUsername, "李四").lt(User::getAge, 30))
);
// SQL: WHERE (username = '张三' AND age > 18) OR (username = '李四' AND age < 30)

// 注意：or() 无参调用会使后续所有条件都变成 OR
// WHERE a = 1 OR b = 2 OR c = 3
qw.eq("a", 1).or().eq("b", 2).eq("c", 3);  // c=3 也是 OR！
```

#### 3.2.7 其他实用方法

| 方法 | 说明 | 示例 |
|------|------|------|
| `allEq` | 全部等于（Map 形式） | `.allEq(params)` |
| `apply` | 拼接 SQL 片段（支持 `{0}` 参数化） | `.apply("date_format(col,'%Y-%m-%d') = {0}", "2024-01-01")` |
| `last` | 拼接到 SQL 最后（有 SQL 注入风险） | `.last("LIMIT 1")` |
| `exists` | `EXISTS` 子查询 | `.exists("SELECT 1 FROM t_order WHERE user_id = t_user.id")` |
| `notExists` | `NOT EXISTS` 子查询 | `.notExists("SELECT 1 FROM ...")` |
| `func` | 条件分支 | `.func(i -> { if (x) i.eq(...); })` |

**示例**：

```java
// 1. allEq：Map 形式的全字段等于查询
Map<String, Object> params = new HashMap<>();
params.put("username", "张三");
params.put("age", 25);
List<User> list = userMapper.selectList(
    Wrappers.<User>query().allEq(params)
);

// 2. apply：拼接原生 SQL 片段（参数使用 {0} 占位防注入）
List<User> list2 = userMapper.selectList(
    Wrappers.<User>query()
        .apply("date_format(create_time,'%Y-%m-%d') = {0}", "2024-01-01")
);

// 3. last：拼接到 SQL 最后（慎用，有 SQL 注入风险）
List<User> list3 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .eq(User::getStatus, 1)
        .last("LIMIT 10")
);

// 4. exists / notExists
List<User> list4 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .exists("SELECT 1 FROM t_order WHERE user_id = t_user.id AND amount > 100")
);

// 5. func：条件分支
String keyword = "张三";
Integer minAge = 18;
List<User> list5 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .func(i -> {
            if (StringUtils.isNotBlank(keyword)) {
                i.like(User::getUsername, keyword);
            } else {
                i.isNotNull(User::getUsername);
            }
        })
        .ge(minAge != null, User::getAge, minAge)
);
```

### 3.3 QueryWrapper / LambdaQueryWrapper

**QueryWrapper** 和 **LambdaQueryWrapper** 专门用于查询条件构造，支持字段筛选。

#### 3.3.1 字段筛选（select）

```java
// 指定字段名（字符串）
List<User> list = userMapper.selectList(
    new QueryWrapper<User>()
        .select("id", "username", "age")
        .eq("status", 1)
);

// 指定字段名（Lambda）
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .select(User::getId, User::getUsername, User::getAge)
        .eq(User::getStatus, 1)
);

// Predicate 过滤：以 "test" 开头的字段
List<User> list3 = userMapper.selectList(
    new QueryWrapper<User>()
        .select(i -> i.getProperty().startsWith("test"))
);
```

> **注意**：`select` 方法多次调用时，**最后一次生效**。`Predicate` 方式会排除主键。

### 3.4 UpdateWrapper / LambdaUpdateWrapper

**UpdateWrapper** 和 **LambdaUpdateWrapper** 专门用于更新条件构造，支持设置 SET 字段。

#### 3.4.1 set 方法

```java
// 将用户名包含"张"的用户年龄设为 30，状态设为 1
userMapper.update(null,
    Wrappers.<User>lambdaUpdate()
        .set(User::getAge, 30)
        .set(User::getStatus, 1)
        .like(User::getUsername, "张")
);
// SQL: UPDATE t_user SET age=30, status=1 WHERE username LIKE '%张%'
```

> **注意**：`set(null)` 会将字段值设为 `null`；`set("")` 会将字段值设为空字符串。`set(boolean condition, ...)` 重载可动态控制是否更新该字段。

#### 3.4.2 setSql 方法

```java
// 原生 SQL SET（年龄自增）
userMapper.update(null,
    new UpdateWrapper<User>()
        .setSql("age = age + 1")
        .eq("status", 1)
);

// 参数化（防 SQL 注入）
userMapper.update(null,
    new UpdateWrapper<User>()
        .setSql("dateColumn={0}", LocalDate.now())
        .eq("id", 1)
);

// 带 condition 重载（动态控制是否应用）
boolean needUpdate = true;
uw.setSql(needUpdate, "score = score + 10");
```

#### 3.4.3 setIncrBy / setDecrBy 原子操作

```java
// 库存 +10（Lambda 版）
LambdaUpdateWrapper<Product> luw = Wrappers.lambdaUpdate();
luw.setIncrBy(Product::getStock, 10)
   .eq(Product::getId, 1);
productMapper.update(null, luw);

// 库存 -1（字符串版）
UpdateWrapper<Product> uw = new UpdateWrapper<>();
uw.setDecrBy("stock", 1).eq("id", 1);
productMapper.update(null, uw);
```

#### 3.4.4 三种创建 LambdaUpdateWrapper 的方式

```java
// 方式一：直接 new
LambdaUpdateWrapper<User> luw1 = new LambdaUpdateWrapper<>();
luw1.set(User::getName, "李四");

// 方式二：从 UpdateWrapper 获取
UpdateWrapper<User> uw = new UpdateWrapper<>();
LambdaUpdateWrapper<User> luw2 = uw.lambda();
luw2.set(User::getName, "李四");

// 方式三：Wrappers 工厂方法（推荐，最简洁）
LambdaUpdateWrapper<User> luw3 = Wrappers.lambdaUpdate();
luw3.set(User::getName, "李四");
```

#### 3.4.5 LambdaUpdateChainWrapper 链式更新

`LambdaUpdateChainWrapper` 来自 `IService` 的 `lambdaUpdate()` 方法，可直接 `.update()` 提交，不需要额外调用 Mapper。

```java
// 在 Service 实现中（继承了 ServiceImpl 即可用）
lambdaUpdate()
    .set(User::getEmail, "new@example.com")
    .eq(User::getId, 1)
    .update();

// 等价于：
LambdaUpdateWrapper<User> luw = Wrappers.lambdaUpdate();
luw.set(User::getEmail, "new@example.com")
   .eq(User::getId, 1);
userMapper.update(null, luw);
```

#### 3.4.6 更新侧 Wrapper 对比

| 特性 | `UpdateWrapper<T>` | `LambdaUpdateWrapper<T>` | `LambdaUpdateChainWrapper<T>` |
| ---- | ------------------ | ------------------------ | ----------------------------- |
| 列名方式 | 字符串 `"name"` | 方法引用 `User::getName` | 方法引用 `User::getName` |
| 类型安全 | 否 | 是 | 是 |
| 使用场景 | 动态列名/跨表 | 通用，推荐默认 | Service 层快速链式更新 |
| 创建方式 | `new UpdateWrapper<>()` | `Wrappers.lambdaUpdate()` | `lambdaUpdate()`（Service 内） |
| 提交方式 | `mapper.update(null, w)` | `mapper.update(null, w)` | 直接 `.update()` |

### 3.5 复杂条件组合实战

#### 3.5.1 动态条件查询（根据参数动态拼接）

```java
public List<User> searchUsers(String username, Integer minAge, Integer maxAge, List<Integer> statuses) {
    LambdaQueryWrapper<User> wrapper = Wrappers.lambdaQuery();

    // 所有条件方法都有 boolean condition 重载，condition=false 时不拼入 SQL
    wrapper.like(StringUtils.isNotBlank(username), User::getUsername, username)
           .ge(minAge != null, User::getAge, minAge)
           .le(maxAge != null, User::getAge, maxAge)
           .in(statuses != null && !statuses.isEmpty(), User::getStatus, statuses);

    return userMapper.selectList(wrapper);
}
```

#### 3.5.2 复杂业务查询示例

```java
// 查询最近 30 天内注册的、年龄 18-35 岁、状态为正常或 VIP 的用户，取前 20 条
LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

List<User> users = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .ge(User::getCreateTime, thirtyDaysAgo)
        .between(User::getAge, 18, 35)
        .in(User::getStatus, 1, 2)
        .orderByDesc(User::getCreateTime)
        .last("LIMIT 20")
);
```

### 3.6 在自定义 SQL 中使用 Wrapper

MyBatis-Plus 支持在自定义 SQL 中引用 Wrapper 构造的条件。

#### 3.6.1 注解方式

```java
public interface UserMapper extends BaseMapper<User> {

    @Select("SELECT * FROM t_user ${ew.customSqlSegment}")
    List<User> selectByCustomWrapper(@Param(Constants.WRAPPER) Wrapper<User> wrapper);
}
```

#### 3.6.2 XML 方式

```xml
<!-- UserMapper.xml -->
<select id="selectByCustomWrapper" resultType="com.example.entity.User">
    SELECT * FROM t_user
    <where>
        ${ew.customSqlSegment}
    </where>
</select>
```

**调用方式**：

```java
List<User> list = userMapper.selectByCustomWrapper(
    Wrappers.<User>lambdaQuery().eq(User::getStatus, 1)
);
```

### 3.7 链式 Wrapper

链式 Wrapper 让你可以在 Service 层直接构建并执行操作，不需要手动调用 Mapper。`IService` 提供了以下初始化方法：

```java
QueryChainWrapper<T> query();
LambdaQueryChainWrapper<T> lambdaQuery();
UpdateChainWrapper<T> update();
LambdaUpdateChainWrapper<T> lambdaUpdate();
```

#### 3.7.1 链式查询

```java
// 查询方法：list() / one() / count() / page()
query().eq("name", "John").list();

lambdaQuery().eq(User::getAge, 30).one();
lambdaQuery().like(User::getName, "王").list();
lambdaQuery().eq(User::getStatus, 1).count();

// 删除方法：remove()
lambdaQuery().eq(User::getStatus, 0).remove();
```

#### 3.7.2 链式更新

```java
// 字符串版
update().set("status", "inactive").eq("name", "John").update();

// Lambda 版
lambdaUpdate().set(User::getStatus, "active").eq(User::getDeptId, 3).update();
```

### 3.8 Wrapper 选择建议

| 场景 | 推荐 |
| ---- | ---- |
| 一般业务查询/更新（字段已知） | `LambdaQueryWrapper` / `LambdaUpdateWrapper` |
| 列名来自配置或动态参数 | `QueryWrapper` / `UpdateWrapper`（字符串更灵活） |
| Service 层快速查询 | `lambdaQuery().eq(...).list()` |
| Service 层快速更新 | `lambdaUpdate().set(...).eq(...).update()` |
| 复杂多表或需复用条件 | 单独构造 Wrapper 传入 Mapper |
| 按 Map 条件查询 | `Wrappers.query().allEq(map)` |

### 3.9 注意事项

1. **线程安全**：Wrapper 不是线程安全的，建议在方法内部新建，不要作为类成员变量共享。
2. **set vs where**：`set(...)` 控制"改什么"，`eq/like/in/gt/lt` 等控制"改哪里"，不要混淆。
3. **set(null) 行为**：`set(column, null)` 会将数据库字段设为 `null`，`set(column, "")` 设为空字符串，注意区分。
4. **condition 参数**：所有条件方法都有 `boolean condition` 重载，可用于动态决定是否拼入该条件。
5. **SQL 注入**：`setSql()` 和 `apply()` 中不要直接拼接用户输入，使用参数化占位符 `{0}`。`last()` 直接拼接到 SQL 末尾，慎用。
6. **select 方法**：多次调用 `select()` 时，最后一次覆盖前一次。
7. **or() 语义**：无参 `or()` 会将**后续所有条件**切换为 OR，不仅仅是紧接的下一个条件。
8. **Kotlin 场景**：Kotlin 中使用 `KtQueryWrapper` / `KtUpdateWrapper`，Lambda 链式调用（`LambdaUpdateChainWrapper`）在 Kotlin 中不直接支持。
9. **自定义 SQL**：可在 Mapper 中通过 `@Select("... ${ew.customSqlSegment}")` 配合 Wrapper 使用（需 3.0.7+）。
