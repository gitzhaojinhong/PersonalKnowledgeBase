## 第四章 Spring 注解式开发

## 4.1 声明 Bean 的注解

Spring 提供四个注解用于将类声明为 Bean，让容器扫描并纳入管理：

+ `@Component`：通用，适用于不好归类的普通组件
+ `@Controller`：语义标记 MVC 控制层
+ `@Service`：语义标记业务逻辑层
+ `@Repository`：语义标记数据访问层

从源码来看，`@Controller`、`@Service`、`@Repository` 都是 `@Component` 的别名（元注解中包含 `@Component`），功能完全等价，加语义注解的目的是提升代码可读性，约定俗成。

Bean 的命名规则：

+ `@Component("userBean")`：显式指定 bean id
+ `@Component`：不指定时，默认 bean id 为类名首字母小写（`UserService` → `userService`）

> SpringBoot 适配：SpringBoot 通过 `@SpringBootApplication`（包含 `@ComponentScan`）自动扫描启动类所在包及其子包。开发者只需在类上加对应注解即可，无需额外 XML 配置。
>

## 4.2 开启组件扫描

XML 方式（引入 context 命名空间后配置）：

```xml
<!-- 扫描单个包 -->
<context:component-scan base-package="com.example.service"/>
<!-- 扫描多个包，用逗号分隔 -->
<context:component-scan base-package="com.example.service,com.example.dao"/>
<!-- 扫描共同父包（最常用）-->
<context:component-scan base-package="com.example"/>
```

全注解方式（配置类）：

```java
@Configuration
@ComponentScan("com.example")
public class SpringConfig {}
```

### 选择性实例化

有时只想让特定注解的 Bean 参与扫描，可以使用 include-filter / exclude-filter：

```xml
<!-- 只扫描 @Controller 标注的类 -->
<context:component-scan base-package="com.example" use-default-filters="false">
    <context:include-filter type="annotation" 
                            expression="org.springframework.stereotype.Controller"/>
</context:component-scan>
<!-- 扫描所有，但排除 @Repository -->
<context:component-scan base-package="com.example">
    <context:exclude-filter type="annotation"
                            expression="org.springframework.stereotype.Repository"/>
</context:component-scan>

```

`use-default-filters="false"` 关闭默认的四个注解扫描规则，然后通过 include-filter 精确指定。

## 4.3 依赖注入注解

### @Value：注入简单类型

`@Value` 用于注入基本类型和 String。可以写在字段上、setter 方法上，或构造方法参数上：

```java
@Component
public class User {
    @Value("张三")          // 直接赋值字符串
    private String name;
    
    @Value("18")            // 数字会自动转换类型
    private int age;
    
    @Value("${app.version}") // 从配置文件读取
    private String version;
}
```

字段上直接使用 `@Value` 时，Spring 通过反射绕过访问修饰符直接赋值，不需要 setter 方法。

> SpringBoot 适配：`@Value` 在 SpringBoot 中同样可用，并且直接从 `application.properties` / `application.yml` 读取对应 key 的值。
>

### @Autowired：注入非简单类型（byType）

`@Autowired` 是 Spring 自带的注解，默认按类型（byType）注入：

```java
@Service
public class UserService {
    @Autowired  // 注入在字段上，无需 setter
    private UserDao userDao;
}
```

`@Autowired` 可标注的位置：字段、setter 方法、构造方法、构造方法参数。

当有且仅有一个有参构造方法时，`@Autowired` 注解可以省略：

```java
@Service
public class UserService {
    private final UserDao userDao;
    
    // 只有一个有参构造，@Autowired 可省略
    public UserService(UserDao userDao) {
        this.userDao = userDao;
    }
}
```

`required` 属性：默认 `true`，表示 Bean 必须存在，找不到则抛异常。设为 `false` 则找不到时注入 null 而不报错：

```java
@Autowired(required = false)
private SomeOptionalService optionalService;
```

### @Qualifier：配合 @Autowired 按名称注入

当一个接口有多个实现类时，纯 byType 无法确定注入哪个，需要 `@Qualifier` 指定 Bean 名称：

```java
// 两个实现类
@Repository("mysqlDao")
public class UserDaoForMySQL implements UserDao {}

@Repository("oracleDao")
public class UserDaoForOracle implements UserDao {}

// 注入时指定名称
@Service
public class UserService {
    @Autowired
    @Qualifier("mysqlDao")
    private UserDao userDao;
}
```

`@Qualifier` 不能单独使用，必须配合 `@Autowired` 一起。

### @Resource：标准注解（byName 优先）

`@Resource` 是 JDK 扩展包（Jakarta/JSR-250）中的注解，不依赖 Spring，通用性更强。

装配规则：

+ 有 `name` 属性：直接按 name 查找
+ 无 `name` 属性：先把字段名（或 setter 对应的属性名）作为 name 查找，找不到再 byType

```java
@Service
public class UserService {
    // 先找 name="userDao" 的 Bean，找不到再 byType
    @Resource
    private UserDao userDao;
    
    // 直接指定 name
    @Resource(name = "mysqlDao")
    private UserDao mysqlUserDao;
}
```

`@Resource` 只能用在字段和 setter 方法上，**不能**用在构造方法上。

`@Autowired` vs `@Resource` 核心区别：

| 对比项 | @Autowired | @Resource |
| --- | --- | --- |
| 来源 | Spring 框架 | JDK 扩展包（JSR-250） |
| 默认策略 | byType | byName |
| 指定名称 | 配合 @Qualifier | name 属性 |
| 可用位置 | 字段/setter/构造/参数 | 字段/setter |


> 注意：Spring 6 / SpringBoot 3 基于 JakartaEE 9，`@Resource` 需要引入 `jakarta.annotation-api` 依赖（JDK 11+ 不再内置）。JDK 8 不需要额外引入。
>

## 4.4 全注解式开发

用 Java 配置类完全替代 spring.xml，是 SpringBoot 的基础。

### @Configuration

标注在类上，表示该类是 Spring 配置类，等价于一个 spring.xml 文件。

```java
@Configuration
@ComponentScan("com.example")
public class SpringConfig {
    // 配置 Bean 的方法写在这里
}
```

### @Bean

标注在配置类的方法上，将方法的返回值作为 Bean 注入容器。适合注入无法使用 @Component 的第三方类：

```java
@Configuration
public class DataSourceConfig {
    @Bean("dataSource")  // bean id 为 "dataSource"，不指定则用方法名
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl("jdbc:mysql://localhost:3306/mydb");
        return ds;
    }
}
```

`@Bean` 方法中可以直接调用同一配置类中的其他 `@Bean` 方法，Spring 会保证返回的是同一个单例（`@Configuration` 类会被 CGLIB 代理）：

```java
@Configuration
public class AppConfig {
    @Bean
    public ServiceA serviceA() {
        return new ServiceA(repository()); // 调用 repository()，仍是同一个实例
    }
    
    @Bean
    public Repository repository() {
        return new RepositoryImpl();
    }
}
```

### @ComponentScan

指定组件扫描的包，与 XML 的 `<context:component-scan>` 等价：

```java
@Configuration
@ComponentScan({"com.example.service", "com.example.dao"})
public class AppConfig {}
```

### @PropertySource

加载外部 properties 文件：

```java
@Configuration
@PropertySource("classpath:jdbc.properties")
public class DataSourceConfig {
    @Value("${jdbc.url}")
    private String url;
}
```

### 启动全注解容器

```java
ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
```

> SpringBoot 适配：SpringBoot 的 `@SpringBootApplication` 注解等价于 `@Configuration + @ComponentScan + @EnableAutoConfiguration`，是全注解开发的终极形式。开发者定义 Bean 只需要 `@Component` 系列注解或在配置类中用 `@Bean`，SpringBoot 会自动处理其余一切。
>

---
