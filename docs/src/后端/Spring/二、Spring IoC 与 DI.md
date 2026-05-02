

## 2.1 IoC 控制反转

IoC（Inversion of Control，控制反转）是 Spring 的核心设计理念。传统编程中，对象的创建和依赖关系由调用方自己 `new` 出来并维护；IoC 将这种控制权反转给了 Spring 容器——对象的创建、初始化、依赖装配全部由容器负责，调用方只需要从容器中取用即可。

IoC 的实现机制是反射：Spring 通过读取配置（XML 或注解），利用反射调用类的无参构造方法来创建对象。因此，**被 Spring 管理的类必须提供无参构造方法**（Java 中若没有显式定义构造方法，编译器会自动生成无参构造方法；但若手动定义了有参构造方法，则无参构造方法需要显式声明）。

IoC 容器在 Spring 中有两个核心接口层级：

+ BeanFactory：最基础的容器接口，懒加载（getBean 时才实例化）
+ ApplicationContext：BeanFactory 的扩展，支持国际化、事件发布、AOP 等，容器启动时即完成所有单例 Bean 的实例化。**实际开发中始终使用 ApplicationContext**

常用的 ApplicationContext 实现类：

+ ClassPathXmlApplicationContext：从类路径加载 XML 配置文件
+ FileSystemXmlApplicationContext：从文件系统路径加载 XML 配置文件
+ AnnotationConfigApplicationContext：基于 Java 配置类（全注解开发）

```java
// XML 方式
ApplicationContext ctx = new ClassPathXmlApplicationContext("spring.xml");
// 全注解方式
ApplicationContext ctx = new AnnotationConfigApplicationContext(SpringConfig.class);
```

> SpringBoot 适配：SpringBoot 内部使用的是 AnnotationConfigServletWebServerApplicationContext（Web 环境）或 AnnotationConfigApplicationContext（非 Web），由 SpringApplication.run() 自动创建，开发者无需手动实例化容器。
>

## 2.2 DI 依赖注入

DI（Dependency Injection，依赖注入）是 IoC 的具体实现方式。IoC 描述的是思想（控制权的反转），DI 描述的是实现手段（通过注入来给对象装配依赖）。两者是同一件事的不同表述角度。

### set 注入

set 注入要求 Bean 类为每个需要注入的属性提供 setter 方法，Spring 通过调用 setter 来完成赋值。这是最常见的 XML 注入方式。

XML 配置方式：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <!-- 简单类型（String/基本类型）-->
    <property name="name" value="张三"/>
    <property name="age" value="18"/>
    <!-- 引用类型：ref 指向另一个 bean 的 id -->
    <property name="userDao" ref="userDao"/>
</bean>
<bean id="userDao" class="com.example.dao.UserDaoImpl"/>
```

注解方式（配合组件扫描）：

```java
@Service
public class UserServiceImpl {
    @Autowired
    private UserDao userDao;
    // 无需 setter，Spring 直接注入字段
}
```

> SpringBoot 适配：SpringBoot 中注解注入方式与 Spring 完全一致，无需额外配置。XML 方式通常不再使用，除非需要集成遗留配置。
>

**外部 Bean 与内部 Bean**：上面示例中 `userDao` 是独立定义的外部 Bean，通过 `ref` 引用。也可以把 Bean 定义嵌套在 `<property>` 内部（内部 Bean），该 Bean 无 id，无法被其他地方引用：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <property name="userDao">
        <bean class="com.example.dao.UserDaoImpl"/>
    </property>
</bean>

```

**级联属性赋值**：通过 `属性.子属性` 直接给嵌套对象的属性赋值，前提是子对象已注入且有对应 setter：

```xml
<bean id="userService" class="com.example.service.UserServiceImpl">
    <property name="userDao" ref="userDao"/>
    <property name="userDao.dataSource" ref="dataSource"/>
</bean>

```

> 了解即可，实际项目中更推荐在各自 Bean 定义中完成依赖注入。
>

### 构造器注入

构造器注入通过带参构造方法来完成依赖传入。优点是注入的依赖不可变（final 字段），对象创建即完成装配；缺点是当依赖过多时构造方法参数列表会很长，可读性下降。

XML 配置方式（按参数名）：

```xml
<bean id="orderService" class="com.example.service.OrderServiceImpl">
    <constructor-arg name="orderDao" ref="orderDao"/>
    <constructor-arg name="name" value="订单服务"/>
</bean>

```

XML 配置方式（按参数索引）：

```xml
<constructor-arg index="0" ref="orderDao"/>
<constructor-arg index="1" value="订单服务"/>
```

注解方式：

```java
@Service
public class OrderServiceImpl {
    private final OrderDao orderDao;
    
    @Autowired
    public OrderServiceImpl(OrderDao orderDao) {
        this.orderDao = orderDao;
    }
}
// 当有且仅有一个有参构造方法时，@Autowired 可以省略
```

> 坑点：构造器注入会导致循环依赖无法解决（两个 Bean 互相依赖且都用构造器注入时，Spring 无法完成初始化），此时需改用 set 注入。
>

### 集合类型的 set 注入

XML 中支持对 List、Set、Map、Properties 类型的属性进行注入：

```xml
<bean id="someBean" class="com.example.SomeBean">
    <!-- List -->
    <property name="nameList">
        <list>
            <value>张三</value>
            <value>李四</value>
        </list>
    </property>
    <!-- Set -->
    <property name="nameSet">
        <set>
            <value>aa</value>
            <value>bb</value>
        </set>
    </property>
    <!-- Map -->
    <property name="map">
        <map>
            <entry key="k1" value="v1"/>
            <entry key="k2" value="v2"/>
        </map>
    </property>
    <!-- Properties -->
    <property name="props">
        <props>
            <prop key="username">root</prop>
            <prop key="password">123456</prop>
        </props>
    </property>
    <!-- 数组 -->
    <property name="scores">
        <array>
            <value>90</value>
            <value>85</value>
        </array>
    </property>
    <!-- null 值 -->
    <property name="address"><null/></property>
    <!-- 空字符串 -->
    <property name="email" value=""/>
    <!-- 也可以写成 <property name="email"><value/></property> -->
    <!-- 包含特殊字符（如 <、>），用 CDATA 包裹 -->
    <property name="expression"><value><![CDATA[2 < 3]]></value></property>
</bean>

```

> SpringBoot 适配：Spring Boot 环境中集合注入通常通过 @ConfigurationProperties 注解绑定 application.properties/yml 中的列表配置，或通过 @Value 注入单个值。
>

### 自动装配（autowire）

XML 中可以为 bean 指定 `autowire` 属性，让 Spring 自动按类型或名称寻找依赖，无需手动 `<property>` 配置：

```xml
<!-- byType：按照属性类型自动查找匹配的 bean（该类型的 bean 只能有一个）-->
<bean id="userService" class="com.example.UserServiceImpl" autowire="byType"/>

<!-- byName：按照属性名称查找同名的 bean id -->
<bean id="userService" class="com.example.UserServiceImpl" autowire="byName"/>
```

注意：`byType` 模式下如果同一类型存在多个 bean，会抛出异常。`byName` 模式下要求 bean 的 id 与属性名完全一致。

> SpringBoot 适配：注解开发中 `@Autowired` 默认 byType，`@Qualifier` 配合指定 byName，等价于 XML 的 autowire 机制。实际开发中 XML 的 autowire 几乎不再使用。
>

## 2.3 外部属性文件注入

实际项目中数据库连接信息等配置不应硬编码在 spring.xml 里，而是抽取到 `.properties` 文件，由 Spring 动态读取。

properties 文件示例（jdbc.properties）：

```properties
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/mydb
jdbc.username=root
jdbc.password=123456
```

XML 方式引入：

```xml
<!-- 引入外部属性文件 -->
<context:property-placeholder location="classpath:jdbc.properties"/>

<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="driverClassName" value="${jdbc.driver}"/>
    <property name="jdbcUrl" value="${jdbc.url}"/>
    <property name="username" value="${jdbc.username}"/>
    <property name="password" value="${jdbc.password}"/>
</bean>

```

注解方式（需要在配置类上声明）：

```java
@Configuration
@PropertySource("classpath:jdbc.properties")
public class DataSourceConfig {

    @Value("${jdbc.driver}")
    private String driver;
    @Value("${jdbc.url}")
    private String url;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setDriverClassName(driver);
        ds.setJdbcUrl(url);
        return ds;
    }
}
```

> SpringBoot 适配：SpringBoot 默认加载 `application.properties` / `application.yml`，通过 `@ConfigurationProperties` 注解可以将配置自动绑定到 Java 对象，比 `@Value` 更推荐用于批量属性。`@PropertySource` 在 SpringBoot 中用于加载额外的配置文件。
>

## 2.4 p 命名空间、c 命名空间与 util 命名空间

这三个是 XML 配置的语法糖，让配置更简洁，了解即可。

p 命名空间（简化 set 注入）：

```xml
<!-- 引入命名空间：xmlns:p="http://www.springframework.org/schema/p" -->
<bean id="user" class="com.example.User" p:name="张三" p:age="18" p:userDao-ref="userDao"/>
```

c 命名空间（简化构造器注入）：

```xml
<!-- 引入命名空间：xmlns:c="http://www.springframework.org/schema/c" -->
<bean id="user" class="com.example.User" c:name="张三" c:age="18"/>
```

util 命名空间（定义可复用的集合 bean）：

```xml
<!-- 引入命名空间：xmlns:util="http://www.springframework.org/schema/util" -->
<util:list id="nameList">
    <value>张三</value>
    <value>李四</value>
</util:list>
<bean id="user" class="com.example.User">
    <property name="names" ref="nameList"/>
</bean>

```

> SpringBoot 适配：SpringBoot 几乎不使用 XML 配置，以上内容在 SpringBoot 中无需掌握。
>

## 2.5 Bean 的 XML 配置详解

### id 与 class 属性

+ `id`：Bean 的唯一标识符，相当于 Bean 的名字，同一配置文件中不允许重复
+ `class`：Bean 的全限定类名，Spring 通过反射调用该类的无参构造方法来创建对象

```xml
<bean id="userBean" class="com.example.bean.User"/>
```

### DTD 与 Schema 约束

Spring 的 XML 配置文件有两种约束格式：

+ DTD 格式（旧）：`<!DOCTYPE beans PUBLIC ...>`，功能简单，已过时
+ Schema 格式（新，推荐）：通过 `xsi:schemaLocation` 引入，支持命名空间扩展（context、aop、tx 等），是当前标准用法

### 多配置文件 import

大型项目通常将配置拆分为多个文件，在主配置文件中汇总引入：

```xml
<import resource="classpath:spring-dao.xml"/>
<import resource="classpath:spring-service.xml"/>
```

> SpringBoot 适配：SpringBoot 通过 @Import 注解引入其他配置类，不使用 XML import 语法。
>

---
