

## 1.1 Spring 简介

Spring 是一个轻量级的 Java 开源框架，核心理念是通过 IoC（控制反转）和 AOP（面向切面编程）来简化企业级应用开发。它并不替代原有的框架，而是以一种优雅的方式将各种框架整合在一起，降低系统各层之间的耦合度。

Spring 官网：[https://spring.io/](https://spring.io/)

Spring Framework 的核心价值体现在两点：一是让对象的创建和管理交给容器，业务代码只关注业务本身；二是将日志、事务、安全等横切关注点从业务逻辑中剥离，统一处理。

## 1.2 Spring 七大模块

Spring Framework 拆分为多个 JAR，按功能可分为七大模块：

+ spring-core / spring-beans：IoC 容器的核心，负责 Bean 的创建与依赖装配
+ spring-context：在核心容器之上提供事件机制、国际化、ApplicationContext 等企业级功能
+ spring-aop：面向切面编程支持，将横切逻辑从业务代码分离
+ spring-jdbc：简化 JDBC 操作，提供 JdbcTemplate
+ spring-tx：声明式与编程式事务管理
+ spring-orm：整合 Hibernate、JPA、MyBatis 等 ORM 框架
+ spring-web / spring-webmvc / spring-webflux：Web 层支持，MVC 框架与响应式 Web 框架

## 1.3 引入 Spring 的 Maven 依赖

只需引入 spring-context，关联依赖（core、beans、aop、expression 等）会自动拉入：

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.2.13</version>
</dependency>

```

> SpringBoot 适配：SpringBoot 的 spring-boot-starter 已经传递引入了 spring-context，无需单独声明。
>

## 1.4 软件开发原则

在学习 Spring 之前，理解这几个原则有助于理解 Spring 的设计动机。

### OCP 开闭原则

对扩展开放，对修改关闭。当需求变化时，应通过增加新代码来实现，而不是修改已有代码。Spring 的 IoC 容器通过配置文件或注解驱动对象创建，让业务代码对具体实现的依赖降到最低，符合 OCP。

### DIP 依赖倒置原则

上层模块不应依赖下层模块的具体实现，二者都应依赖抽象（接口）。Spring 的依赖注入正是这一原则的落地：调用方只声明需要一个接口类型，具体的实现由容器注入。

### 其他 SOLID 原则

+ SRP 单一职责：一个类只负责一件事
+ LSP 里氏替换：子类可以完全替换父类出现的位置
+ ISP 接口隔离：不强迫类依赖它用不到的接口

---
