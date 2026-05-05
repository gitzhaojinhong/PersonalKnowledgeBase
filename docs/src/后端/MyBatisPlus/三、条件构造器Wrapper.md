## 三、条件构造器 Wrapper

### 3.1 Wrapper 体系概述

**Wrapper** 是 MyBatis-Plus 用于构造动态 SQL 条件的核心对象。整个 Wrapper 体系如下：

```
AbstractWrapper
    ├── QueryWrapper          (普通查询条件)
    ├── UpdateWrapper         (普通更新条件)
    ├── AbstractLambdaWrapper
            ├── LambdaQueryWrapper     (Lambda 查询条件，类型安全)
            └── LambdaUpdateWrapper    (Lambda 更新条件，类型安全)
```

**选择建议**：
- **简单场景/字段名固定**：使用 `QueryWrapper` / `UpdateWrapper`
- **企业开发/追求类型安全**：**强烈推荐使用 `LambdaQueryWrapper` / `LambdaUpdateWrapper`**
- **Kotlin 项目**：使用 `KtQueryWrapper` / `KtUpdateWrapper`

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

**示例**：

```java
// 查询年龄 18-30 岁之间的用户
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .between(User::getAge, 18, 30)
);

// 查询状态不等于删除的用户
List<User> activeUsers = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .ne(User::getDeleted, 1)
);
```

#### 3.2.2 模糊查询

| 方法 | 说明 | 生成 SQL |
|------|------|---------|
| `like` | 全模糊 | `LIKE '%值%'` |
| `notLike` | 全模糊取反 | `NOT LIKE '%值%'` |
| `likeLeft` | 左模糊 | `LIKE '%值'` |
| `likeRight` | 右模糊 | `LIKE '值%'` |

**示例**：

```java
// 查询用户名包含"张"的用户
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .like(User::getUsername, "张")
);

// 查询邮箱以 @qq.com 结尾的用户
List<User> qqUsers = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .likeLeft(User::getEmail, "@qq.com")
);

// 查询用户名以 admin 开头的用户
List<User> admins = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .likeRight(User::getUsername, "admin")
);
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
// IN 查询
List<Long> ids = Arrays.asList(1L, 2L, 3L);
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .in(User::getId, ids)
);

// IN 可变参数
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .in(User::getAge, 18, 20, 25, 30)
);

// IN 子查询
List<User> list3 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .inSql(User::getId, "SELECT user_id FROM t_order WHERE amount > 100")
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
// 按年龄分组统计
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
| `and` | AND 嵌套，括号包裹 |
| `or` | 拼接 OR |
| `or(Consumer)` | OR 嵌套，括号包裹 |
| `nested` | 正常嵌套（AND） |

**示例**：

```java
// 复杂条件：(username = '张三' AND age > 18) OR (username = '李四' AND age < 30)
List<User> list = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .and(qw -> qw.eq(User::getUsername, "张三").gt(User::getAge, 18))
        .or(qw -> qw.eq(User::getUsername, "李四").lt(User::getAge, 30))
);

// 等效 SQL：
// WHERE (username = '张三' AND age > 18) OR (username = '李四' AND age < 30)
```

#### 3.2.7 其他实用方法

| 方法 | 说明 | 示例 |
|------|------|------|
| `allEq` | 全部等于（Map 形式） | `.allEq(params)` |
| `apply` | 拼接 SQL 片段 | `.apply("date_format(create_time,'%Y-%m-%d') = {0}", "2024-01-01")` |
| `last` | 拼接到 SQL 最后（有 SQL 注入风险） | `.last("limit 1")` |
| `exists` | `EXISTS` 子查询 | `.exists("SELECT 1 FROM t_order WHERE user_id = t_user.id")` |
| `func` | 条件分支 | `.func(i -> { if (condition) i.eq(...); })` |

**示例**：

```java
// 1. allEq：Map 形式的全字段等于查询
Map<String, Object> params = new HashMap<>();
params.put("username", "张三");
params.put("age", 25);
params.put("status", 1);
List<User> list = userMapper.selectList(
    Wrappers.<User>query().allEq(params)
);
// 等效 SQL：SELECT * FROM t_user WHERE username = '张三' AND age = 25 AND status = 1

// 2. apply：拼接原生 SQL 片段（注意 SQL 注入风险，参数使用 {0} 占位）
List<User> list2 = userMapper.selectList(
    Wrappers.<User>query()
        .apply("date_format(create_time,'%Y-%m-%d') = {0}", "2024-01-01")
);

// 3. last：拼接到 SQL 最后（有 SQL 注入风险，谨慎使用）
List<User> list3 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .eq(User::getStatus, 1)
        .last("LIMIT 10")  // 限制返回 10 条
);

// 4. exists：EXISTS 子查询
List<User> list4 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .exists("SELECT 1 FROM t_order WHERE user_id = t_user.id AND amount > 100")
);

// 5. func：条件分支（在链式调用中根据条件动态选择方法）
String keyword = "张三";
Integer minAge = 18;
List<User> list5 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .func(StringUtils.isNotBlank(keyword),
            wrapper -> wrapper.like(User::getUsername, keyword),
            wrapper -> wrapper.isNotNull(User::getUsername)
        )
        .func(minAge != null,
            wrapper -> wrapper.ge(User::getAge, minAge)
        )
);
```

### 3.3 QueryWrapper / LambdaQueryWrapper

**QueryWrapper** 和 **LambdaQueryWrapper** 专门用于查询条件构造，支持字段筛选。

#### 3.3.1 字段筛选（select）

```java
// 只查询 id, username, age 三个字段
List<User> list = userMapper.selectList(
    new QueryWrapper<User>()
        .select("id", "username", "age")
        .eq("status", 1)
);

// Lambda 方式字段筛选
List<User> list2 = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .select(User::getId, User::getUsername, User::getAge)
        .eq(User::getStatus, 1)
);
```

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

// 等效 SQL：UPDATE t_user SET age=30, status=1 WHERE username LIKE '%张%'
```

#### 3.4.2 setSql 方法

```java
// 使用原生 SQL SET
userMapper.update(null,
    new UpdateWrapper<User>()
        .setSql("age = age + 1")  // 年龄自增
        .eq("status", 1)
);
```

### 3.5 复杂条件组合实战

#### 3.5.1 动态条件查询（根据参数动态拼接）

```java
public List<User> searchUsers(String username, Integer minAge, Integer maxAge, List<Integer> statuses) {
    LambdaQueryWrapper<User> wrapper = Wrappers.lambdaQuery();
    
    // 动态条件拼接
    wrapper.like(StringUtils.isNotBlank(username), User::getUsername, username)
           .ge(minAge != null, User::getAge, minAge)
           .le(maxAge != null, User::getAge, maxAge)
           .in(statuses != null && !statuses.isEmpty(), User::getStatus, statuses);
    
    return userMapper.selectList(wrapper);
}
```

> **关键点**：所有 Wrapper 方法都提供了带 `boolean condition` 参数的重载，当 condition 为 false 时，该条件不会加入最终 SQL。

#### 3.5.2 复杂业务查询示例

```java
// 场景：查询最近 30 天内注册的、年龄在 18-35 岁之间、
// 状态为正常或 VIP 的用户，按注册时间倒序，取前 20 条

LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

List<User> users = userMapper.selectList(
    Wrappers.<User>lambdaQuery()
        .ge(User::getCreateTime, thirtyDaysAgo)
        .between(User::getAge, 18, 35)
        .in(User::getStatus, 1, 2)  // 1-正常, 2-VIP
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

---
