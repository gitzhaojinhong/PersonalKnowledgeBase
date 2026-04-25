

## 7.1 为什么要整合

单独使用 MyBatis 时，开发者需要手动管理 SqlSessionFactory、SqlSession 的创建与关闭，并且 MyBatis 自身不提供事务管理能力。Spring 整合 MyBatis 的核心价值在于：

+ 将 SqlSessionFactory 纳入 Spring 容器管理，统一生命周期
+ 通过 MapperScannerConfigurer 自动扫描 Mapper 接口，省去手动 getMapper()
+ 让 Spring 的声明式事务（@Transactional）接管 MyBatis 的事务，实现统一的事务管理
+ 与 Spring IoC/DI 无缝协作，Mapper 可以直接 @Autowired 注入 Service

整合需要引入的关键依赖：

+ `spring-jdbc`：提供 Spring 的 JDBC 抽象和事务管理基础
+ `mybatis-spring`：MyBatis 官方提供的 Spring 集成桥接包

## 7.2 Maven 依赖

```xml
<!-- Spring 上下文 -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.13</version>
</dependency>
<!-- Spring JDBC（事务管理依赖） -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-jdbc</artifactId>
    <version>6.2.13</version>
</dependency>
<!-- MyBatis -->
<dependency>
    <groupId>org.mybatis</groupId>
    <artifactId>mybatis</artifactId>
    <version>3.5.16</version>
</dependency>
<!-- MyBatis-Spring 桥接包 -->
<dependency>
    <groupId>org.mybatis</groupId>
    <artifactId>mybatis-spring</artifactId>
    <version>3.0.4</version>
</dependency>
<!-- 数据库连接池 -->
<dependency>
    <groupId>com.zaxxer</groupId>
    <artifactId>HikariCP</artifactId>
    <version>7.0.2</version>
</dependency>
<!-- MySQL 驱动 -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.4.0</version>
</dependency>

```

## 7.3 核心配置项

Spring 整合 MyBatis 的 XML 配置中有四个关键 Bean：

### 数据源

```xml
<context:property-placeholder location="classpath:jdbc.properties"/>

<bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
    <property name="driverClassName" value="${jdbc.driver}"/>
    <property name="jdbcUrl"         value="${jdbc.url}"/>
    <property name="username"        value="${jdbc.username}"/>
    <property name="password"        value="${jdbc.password}"/>
</bean>

```

### SqlSessionFactoryBean

`SqlSessionFactoryBean` 是 MyBatis-Spring 提供的 FactoryBean 实现，负责创建 MyBatis 的 `SqlSessionFactory`：

```xml
<bean class="org.mybatis.spring.SqlSessionFactoryBean">
    <!-- 引用 MyBatis 自身的配置文件（可选，仅放 settings 等 MyBatis 级别配置） -->
    <property name="configLocation" value="classpath:mybatis-config.xml"/>
    <!-- 注入数据源 -->
    <property name="dataSource" ref="dataSource"/>
    <!-- 实体类别名包，配置后 resultType 可以直接写类名而不用全限定名 -->
    <property name="typeAliasesPackage" value="com.example.entity"/>
</bean>

```

> 说明：`configLocation` 属性不是必须的。如果不需要 MyBatis 级别的设置（如开启下划线转驼峰、标准日志），可以完全省略 mybatis-config.xml。
>

mybatis-config.xml 的典型内容（仅保留 Spring 无法替代的设置）：

```xml
<configuration>
    <settings>
        <!-- 开启 MyBatis 标准日志 -->
        <setting name="logImpl" value="STDOUT_LOGGING"/>
        <!-- 开启下划线转驼峰自动映射 -->
        <setting name="mapUnderscoreToCamelCase" value="true"/>
    </settings>
</configuration>

```

### MapperScannerConfigurer

自动扫描指定包下的所有 Mapper 接口，为每个接口生成代理实现类并注入容器：

```xml
<bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
    <property name="basePackage" value="com.example.mapper"/>
</bean>

```

配置后，所有 Mapper 接口可以直接在 Service 层 @Autowired 注入：

```java
@Service
public class AccountServiceImpl implements AccountService {
    @Autowired
    private AccountMapper accountMapper;  // 无需手动 getMapper()
}
```

### 事务管理器

```xml
<bean id="txManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
    <property name="dataSource" ref="dataSource"/>
</bean>
<!-- 开启注解驱动的事务 -->
<tx:annotation-driven transaction-manager="txManager"/>
```

## 7.4 完整 XML 配置示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:context="http://www.springframework.org/schema/context"
       xmlns:tx="http://www.springframework.org/schema/tx"
       xsi:schemaLocation="...">

    <context:component-scan base-package="com.example"/>
    <context:property-placeholder location="classpath:jdbc.properties"/>

    <bean id="dataSource" class="com.zaxxer.hikari.HikariDataSource">
        <property name="driverClassName" value="${jdbc.driver}"/>
        <property name="jdbcUrl"         value="${jdbc.url}"/>
        <property name="username"        value="${jdbc.username}"/>
        <property name="password"        value="${jdbc.password}"/>
    </bean>
    <bean class="org.mybatis.spring.SqlSessionFactoryBean">
        <property name="configLocation" value="classpath:mybatis-config.xml"/>
        <property name="dataSource"     ref="dataSource"/>
        <property name="typeAliasesPackage" value="com.example.entity"/>
    </bean>
    <bean class="org.mybatis.spring.mapper.MapperScannerConfigurer">
        <property name="basePackage" value="com.example.mapper"/>
    </bean>
    <bean id="txManager"
          class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
        <property name="dataSource" ref="dataSource"/>
    </bean>
    <tx:annotation-driven transaction-manager="txManager"/>
</beans>

```

## 7.5 全注解配置（配置类方式）

```java
@Configuration
@ComponentScan("com.example")
@PropertySource("classpath:application.properties")
@EnableTransactionManagement
@EnableAspectJAutoProxy
@MapperScan("com.example.mapper")  // 等价于 MapperScannerConfigurer
public class SpringMyBatisConfig {

    @Bean
    public DataSource dataSource(
            @Value("${spring.datasource.driver}") String driver,
            @Value("${spring.datasource.url}")    String url,
            @Value("${spring.datasource.user}")   String user,
            @Value("${spring.datasource.password}") String password) {
        HikariDataSource ds = new HikariDataSource();
        ds.setDriverClassName(driver);
        ds.setJdbcUrl(url);
        ds.setUsername(user);
        ds.setPassword(password);
        return ds;
    }

    @Bean
    public SqlSessionFactoryBean sqlSessionFactory(
            DataSource dataSource,
            @Value("${mybatis.config.location}") String configLocation,
            @Value("${mybatis.type.aliases.package}") String aliasesPackage) {
        SqlSessionFactoryBean factoryBean = new SqlSessionFactoryBean();
        factoryBean.setConfigLocation(new ClassPathResource(configLocation));
        factoryBean.setDataSource(dataSource);
        factoryBean.setTypeAliasesPackage(aliasesPackage);
        return factoryBean;
    }

    @Bean
    public DataSourceTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
```

> SpringBoot 适配：SpringBoot + MyBatis 只需引入 `mybatis-spring-boot-starter`，自动完成 SqlSessionFactory、MapperScannerConfigurer 的配置。在配置文件中设置数据源信息和 `mybatis.mapper-locations`，在启动类或配置类上加 `@MapperScan` 指定 Mapper 包路径即可。整合复杂度远低于纯 Spring 手动配置。
>

> 坑点：
>
> + Mapper XML 文件必须放在与接口同名的 resources 子目录下（如 `resources/com/example/mapper/AccountMapper.xml`），且文件名与接口名一致，否则 MyBatis 找不到 SQL
> + `typeAliasesPackage` 配置的是实体类所在包，配置后 Mapper XML 中 `resultType` 可以直接写类名（不区分大小写）
> + 测试时务必验证事务是否生效：通过在业务方法中间故意抛出异常，检查数据库是否回滚
>

---
