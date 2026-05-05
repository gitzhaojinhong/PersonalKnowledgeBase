## 二、核心 CRUD 操作

### 2.1 BaseMapper 基础 CRUD

**BaseMapper** 是 MyBatis-Plus 提供的通用 Mapper 接口，继承后即可获得单表的基础 CRUD 能力。**适用于数据访问层（DAO/Mapper 层）**。

#### 2.1.1 插入操作

```java
// 插入一条记录，返回影响行数
int insert(T entity);
```

**示例**：

```java
User user = new User();
user.setUsername("张三");
user.setAge(25);
user.setEmail("zhangsan@example.com");

int rows = userMapper.insert(user);
// 插入后，user.getId() 会自动回填主键值
System.out.println("影响行数：" + rows);
System.out.println("主键值：" + user.getId());
```

#### 2.1.2 删除操作

| 方法 | 说明 |
|------|------|
| `int deleteById(Serializable id)` | 根据 ID 删除 |
| `int deleteByMap(Map<String, Object> columnMap)` | 根据 columnMap 条件删除 |
| `int deleteBatchIds(Collection<? extends Serializable> idList)` | 根据 ID 批量删除 |
| `int delete(Wrapper<T> wrapper)` | 根据条件构造器删除 |

**示例**：

```java
// 1. 根据 ID 删除
userMapper.deleteById(1L);

// 2. 根据 Map 条件删除
Map<String, Object> map = new HashMap<>();
map.put("age", 25);
userMapper.deleteByMap(map);  // DELETE FROM t_user WHERE age = 25

// 3. 批量删除
List<Long> ids = Arrays.asList(1L, 2L, 3L);
userMapper.deleteBatchIds(ids);  // DELETE FROM t_user WHERE id IN (1,2,3)

// 4. 条件删除（配合 Wrapper）
userMapper.delete(
    Wrappers.<User>lambdaQuery()
        .eq(User::getAge, 25)
        .like(User::getUsername, "张")
);
```

#### 2.1.3 更新操作

| 方法 | 说明 |
|------|------|
| `int updateById(T entity)` | 根据 ID 修改（只更新非空字段） |
| `int update(T entity, Wrapper<T> updateWrapper)` | 根据条件更新 |

**示例**：

```java
// 1. 根据 ID 更新
User user = new User();
user.setId(1L);
user.setAge(30);  // 只更新 age 字段，其他字段保持原值
userMapper.updateById(user);

// 2. 条件更新（将年龄大于25且用户名包含"张"的用户的年龄设为30）
User updateUser = new User();
updateUser.setAge(30);

userMapper.update(updateUser,
    Wrappers.<User>lambdaUpdate()
        .gt(User::getAge, 25)
        .like(User::getUsername, "张")
);
```

#### 2.1.4 查询操作

| 方法 | 说明 |
|------|------|
| `T selectById(Serializable id)` | 根据 ID 查询 |
| `List<T> selectBatchIds(Collection<? extends Serializable> idList)` | 根据 ID 批量查询 |
| `List<T> selectByMap(Map<String, Object> columnMap)` | 根据 Map 条件查询 |
| `T selectOne(Wrapper<T> queryWrapper)` | 根据条件查询一条记录 |
| `List<T> selectList(Wrapper<T> queryWrapper)` | 根据条件查询列表 |
| `List<Map<String, Object>> selectMaps(Wrapper<T> queryWrapper)` | 查询列表，返回 Map 集合 |
| `List<Object> selectObjs(Wrapper<T> queryWrapper)` | 查询全部记录（只返回第一个字段） |
| `Integer selectCount(Wrapper<T> queryWrapper)` | 根据条件查询总记录数 |
| `boolean exists(Wrapper<T> queryWrapper)` | 根据条件判断记录是否存在 |
| `IPage<T> selectPage(IPage<T> page, Wrapper<T> queryWrapper)` | 分页查询 |
| `IPage<Map<String, Object>> selectMapsPage(...)` | 分页查询，返回 Map |

**示例**：

```java
// 1. 根据 ID 查询
User user = userMapper.selectById(1L);

// 2. 批量查询
List<Long> ids = Arrays.asList(1L, 2L, 3L);
List<User> users = userMapper.selectBatchIds(ids);

// 3. 条件查询列表
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .gt(User::getAge, 20)
        .orderByDesc(User::getCreateTime)
);

// 4. 查询总记录数
long count = userMapper.selectCount(
    Wrappers.<User>lambdaQuery().eq(User::getAge, 25)
);

// 5. 判断是否存在（比 count > 0 更高效）
boolean hasUser = userMapper.exists(
    Wrappers.<User>lambdaQuery().eq(User::getUsername, "张三")
);
// 等效 SQL：SELECT 1 FROM t_user WHERE username = '张三' LIMIT 1

// 6. 查询列表，返回 Map 集合（key 为数据库列名）
List<Map<String, Object>> mapList = userMapper.selectMaps(
    Wrappers.<User>lambdaQuery().eq(User::getStatus, 1)
);
for (Map<String, Object> map : mapList) {
    String username = (String) map.get("username");
    Integer age = (Integer) map.get("age");
}

// 7. 查询全部记录，只返回第一个字段（通常用于只查 ID 的场景）
List<Object> idList = userMapper.selectObjs(
    Wrappers.<User>lambdaQuery().eq(User::getStatus, 1)
);
// 返回 List<Object>，实际元素类型与主键类型一致

// 8. 分页查询返回 Map
Page<Map<String, Object>> page = new Page<>(1, 10);
Page<Map<String, Object>> result = userMapper.selectMapsPage(page,
    Wrappers.<User>lambdaQuery().gt(User::getAge, 18)
);
```

### 2.2 IService 高级 CRUD

**IService** 是 MyBatis-Plus 提供的通用 Service 接口，进一步封装了 CRUD 操作，采用 `get`、`remove`、`list`、`page` 前缀命名方式区分 Mapper 层。**适用于业务层（Service 层）**。

#### 2.2.1 插入操作

| 方法 | 说明 |
|------|------|
| `boolean save(T entity)` | 插入一条记录 |
| `boolean saveBatch(Collection<T> entityList)` | 批量插入（默认批次大小 1000） |
| `boolean saveBatch(Collection<T> entityList, int batchSize)` | 批量插入，指定批次大小 |

**示例**：

```java
// 1. 单条插入
User user = new User();
user.setUsername("李四");
user.setAge(28);
userService.save(user);

// 2. 批量插入
List<User> userList = new ArrayList<>();
for (int i = 0; i < 10; i++) {
    User u = new User();
    u.setUsername("user" + i);
    u.setAge(20 + i);
    userList.add(u);
}
userService.saveBatch(userList);  // 默认每 1000 条一批
userService.saveBatch(userList, 500);  // 每 500 条一批
```

#### 2.2.2 SaveOrUpdate 智能保存

| 方法 | 说明 |
|------|------|
| `boolean saveOrUpdate(T entity)` | 根据主键判断：存在则更新，不存在则插入 |
| `boolean saveOrUpdate(T entity, Wrapper<T> updateWrapper)` | 先尝试根据 Wrapper 更新，失败则插入 |
| `boolean saveOrUpdateBatch(Collection<T> entityList)` | 批量修改插入 |
| `boolean saveOrUpdateBatch(Collection<T> entityList, int batchSize)` | 批量修改插入，指定批次大小 |

**示例**：

```java
// 场景：导入用户数据，存在则更新，不存在则新增
User user = new User();
user.setId(1L);  // 若 id 存在则更新，不存在则插入
user.setUsername("张三（更新）");
user.setAge(30);
userService.saveOrUpdate(user);

// 批量导入场景
List<User> importList = fetchFromExcel();
userService.saveOrUpdateBatch(importList);
```

#### 2.2.3 删除操作

| 方法 | 说明 |
|------|------|
| `boolean removeById(Serializable id)` | 根据 ID 删除 |
| `boolean removeByMap(Map<String, Object> columnMap)` | 根据 Map 条件删除 |
| `boolean removeByIds(Collection<? extends Serializable> idList)` | 根据 ID 批量删除 |
| `boolean remove(Wrapper<T> queryWrapper)` | 根据条件删除 |

**示例**：

```java
// 1. 根据 ID 删除（逻辑删除时会自动填充 deleted 字段）
userService.removeById(1L);

// 2. 根据 Map 条件删除
Map<String, Object> map = new HashMap<>();
map.put("status", 0);
userService.removeByMap(map);  // DELETE FROM t_user WHERE status = 0

// 3. 批量删除
List<Long> ids = Arrays.asList(1L, 2L, 3L);
userService.removeByIds(ids);  // DELETE FROM t_user WHERE id IN (1,2,3)

// 4. 条件删除（删除年龄小于 18 的用户）
userService.remove(
    Wrappers.<User>lambdaQuery().lt(User::getAge, 18)
);
```

#### 2.2.4 更新操作

| 方法 | 说明 |
|------|------|
| `boolean updateById(T entity)` | 根据 ID 更新 |
| `boolean update(T entity, Wrapper<T> updateWrapper)` | 根据条件更新 |
| `boolean updateBatchById(Collection<T> entityList)` | 根据 ID 批量更新 |
| `boolean updateBatchById(Collection<T> entityList, int batchSize)` | 批量更新，指定批次大小 |

**示例**：

```java
// 1. 根据 ID 更新（只更新非空字段）
User user = new User();
user.setId(1L);
user.setAge(30);
userService.updateById(user);

// 2. 条件更新（将所有状态为 0 的用户年龄设为 18）
User updateUser = new User();
updateUser.setAge(18);
userService.update(updateUser,
    Wrappers.<User>lambdaUpdate().eq(User::getStatus, 0)
);

// 3. 批量更新（根据 ID 批量修改）
List<User> updateList = new ArrayList<>();
for (int i = 1; i <= 5; i++) {
    User u = new User();
    u.setId((long) i);
    u.setAge(20 + i);
    updateList.add(u);
}
userService.updateBatchById(updateList);  // 默认每 1000 条一批
userService.updateBatchById(updateList, 500);  // 每 500 条一批
```

#### 2.2.5 查询操作

| 方法 | 说明 |
|------|------|
| `T getById(Serializable id)` | 根据 ID 查询 |
| `T getOne(Wrapper<T> queryWrapper)` | 根据条件查询一条（多条会抛异常） |
| `T getOne(Wrapper<T> queryWrapper, boolean throwEx)` | 查询一条，可控制是否抛异常 |
| `List<T> list()` | 查询所有 |
| `List<T> list(Wrapper<T> queryWrapper)` | 条件查询列表 |
| `Collection<T> listByIds(Collection<? extends Serializable> idList)` | 根据 ID 批量查询 |
| `long count()` | 查询总记录数 |
| `long count(Wrapper<T> queryWrapper)` | 条件计数 |

**示例**：

```java
// 1. 根据 ID 查询
User user = userService.getById(1L);

// 2. 根据条件查询一条（结果有多条会抛异常）
User one = userService.getOne(
    Wrappers.<User>lambdaQuery().eq(User::getUsername, "张三")
);

// 3. 查询一条，不抛异常（结果有多条时返回第一条）
User first = userService.getOne(
    Wrappers.<User>lambdaQuery().like(User::getUsername, "张"),
    false  // 不抛异常
);

// 4. 查询所有
List<User> all = userService.list();

// 5. 条件查询列表
List<User> list = userService.list(
    Wrappers.<User>lambdaQuery().gt(User::getAge, 18)
);

// 6. 根据 ID 批量查询
List<Long> ids = Arrays.asList(1L, 2L, 3L);
Collection<User> users = userService.listByIds(ids);

// 7. 查询总记录数
long total = userService.count();

// 8. 条件计数
long count = userService.count(
    Wrappers.<User>lambdaQuery().eq(User::getStatus, 1)
);
```

#### 2.2.6 分页查询

| 方法 | 说明 |
|------|------|
| `IPage<T> page(IPage<T> page)` | 无条件分页 |
| `IPage<T> page(IPage<T> page, Wrapper<T> queryWrapper)` | 条件分页 |
| `IPage<Map<String, Object>> pageMaps(...)` | 分页返回 Map |

**示例**：

```java
// 1. 无条件分页（查询第 1 页，每页 10 条）
Page<User> page = new Page<>(1, 10);
Page<User> result = userService.page(page);

// 2. 条件分页
Page<User> page2 = new Page<>(2, 20);
Page<User> result2 = userService.page(page2,
    Wrappers.<User>lambdaQuery()
        .gt(User::getAge, 18)
        .orderByDesc(User::getCreateTime)
);

// 3. 分页返回 Map（字段名作为 key）
Page<Map<String, Object>> mapPage = new Page<>(1, 10);
Page<Map<String, Object>> result3 = userService.pageMaps(mapPage,
    Wrappers.<User>lambdaQuery().eq(User::getStatus, 1)
);
// 取结果
List<Map<String, Object>> records = result3.getRecords();
for (Map<String, Object> record : records) {
    String username = (String) record.get("username");
    Integer age = (Integer) record.get("age");
}
```

### 2.3 链式查询（Query Chain / Update Chain）

IService 提供了**链式编程**风格，让代码更加简洁优雅。

#### 2.3.1 查询链式操作

```java
// 普通链式查询
User user = userService.query()
    .eq("username", "张三")
    .eq("age", 25)
    .one();  // 查询单条

List<User> list = userService.query()
    .gt("age", 20)
    .like("username", "张")
    .list();  // 查询列表

long count = userService.query()
    .ge("age", 18)
    .count();  // 查询数量

// Lambda 链式查询（推荐，类型安全）
User user2 = userService.lambdaQuery()
    .eq(User::getUsername, "张三")
    .eq(User::getAge, 25)
    .one();

List<User> list2 = userService.lambdaQuery()
    .gt(User::getAge, 20)
    .like(User::getUsername, "张")
    .list();
```

#### 2.3.2 更新链式操作

```java
// 普通链式更新
boolean success = userService.update()
    .set("age", 30)
    .eq("username", "张三")
    .update();

// Lambda 链式更新
boolean success2 = userService.lambdaUpdate()
    .set(User::getAge, 30)
    .set(User::getEmail, "new@example.com")
    .eq(User::getUsername, "张三")
    .update();

// 链式删除
userService.lambdaUpdate()
    .eq(User::getAge, 25)
    .remove();
```

### 2.4 批量操作最佳实践

**一定要加 `@Transactional` 事务！**不管是 MP 默认的 `saveBatch`，还是用的**真批量插入**，**都必须加事务**

而且需要指定：`rollbackFor = Exception.class`：**所有异常都回滚（最安全）**

```java
// 批量插入（性能最优）
List<User> list = generateUserList(10000);
userService.saveBatch(list, 1000);  // 每 1000 条执行一次批量插入

// 批量更新
List<User> updateList = fetchUpdatedUsers();
userService.updateBatchById(updateList, 500);

// 批量 SaveOrUpdate（存在更新，不存在插入）
List<User> mixedList = fetchMixedUsers();
userService.saveOrUpdateBatch(mixedList, 1000);
```

### 2.5 BaseMapper 与 IService 命名对照表

| 操作类型 | BaseMapper 方法 | IService 方法 |
|---------|----------------|--------------|
| 插入 | `insert` | `save` / `saveBatch` |
| 删除 | `deleteById` / `delete` | `removeById` / `remove` |
| 更新 | `updateById` / `update` | `updateById` / `update` |
| 查询单条 | `selectById` / `selectOne` | `getById` / `getOne` |
| 查询列表 | `selectList` | `list` |
| 分页查询 | `selectPage` | `page` |
| 计数 | `selectCount` | `count` |

> **使用建议**：**业务层优先使用 IService**，功能更丰富、命名更清晰、支持链式调用和批量操作；**数据访问层使用 BaseMapper**，适用于简单场景或需要与自定义 SQL 混用的场景。

#### 2.5.1 条件构造器选择指南

| 构造器 | 操作类型 | 字段指定方式 | 类型安全 | 推荐场景 |
|--------|---------|-------------|---------|---------|
| `QueryWrapper` | 查询 | 字符串字段名 | 低（运行时） | 动态字段名场景 |
| `LambdaQueryWrapper` | 查询 | Lambda 方法引用 | **高（编译时）** | **所有查询场景（强烈推荐）** |
| `UpdateWrapper` | 更新 | 字符串字段名 | 低（运行时） | 无需实体的更新 |
| `LambdaUpdateWrapper` | 更新 | Lambda 方法引用 | **高（编译时）** | **所有更新场景（强烈推荐）** |

---
