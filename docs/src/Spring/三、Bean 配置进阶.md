

## 3.1 Bean 的作用域（Scope）

Bean 的作用域决定了容器创建 Bean 实例的策略和生命周期范围。通过 `scope` 属性配置：

### singleton（单例：默认）

单例作用域：整个 IoC 容器中只存在一个实例，所有 getBean() 调用返回的都是同一个对象。容器启动时即创建，容器销毁时销毁。

```xml
<bean id="userService" class="com.example.UserServiceImpl" scope="singleton"/>
```

```java
@Component // 默认就是 singleton，无需额外声明
@Scope("singleton")  // 也可显式声明
public class UserService {}
```

### prototype（多例）

多例作用域：每次 getBean() 都创建一个新实例，Spring 负责创建但不负责销毁（由 GC 回收）。

```xml
<bean id="shoppingCart" class="com.example.ShoppingCart" scope="prototype"/>
```

```java
@Component
@Scope("prototype")
public class ShoppingCart {}
```

使用场景：有状态的 Bean（如购物车、用户会话对象）应使用 prototype，防止多线程共用同一实例导致数据污染。

### Web 相关作用域

仅在 Web 环境（ApplicationContext 为 WebApplicationContext）下可用：

+ `request`：每次 HTTP 请求创建一个新实例，请求结束销毁
+ `session`：每个 HTTP Session 对应一个实例，Session 失效销毁
+ `application`：整个 ServletContext 生命周期内只有一个实例
+ `websocket`：每个 WebSocket 会话一个实例

```java
@Component
@Scope(value = WebApplicationContext.SCOPE_REQUEST, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class LoginUser {}
```

> SpringBoot 适配：scope 在 SpringBoot 中使用方式完全相同。不过在 SpringBoot 的 Web 项目中，controller 本身是 singleton，如果需要 request/session 作用域的 Bean，必须配合 proxyMode 使用作用域代理，否则单例 Bean 中注入的 request-scoped Bean 引用会不正确。**但在springboot中也不建议这样写**，一般建议直接在controller方法上直接写参数：HttpServletRequest / HttpSession
>

> 坑点：prototype scope 的 Bean 注入到 singleton Bean 中，每次调用 singleton Bean 方法时拿到的仍是同一个 prototype 实例，因为 singleton Bean 只被创建一次，注入只发生一次。解决方案：让 singleton Bean 实现 ApplicationContextAware，每次用时自己从容器 getBean；或使用 @Lookup 注解。
>

## 3.2 Bean 的生命周期

Spring 管理 Bean 从创建到销毁的完整过程，掌握生命周期有助于在正确的时机做初始化和清理工作。

### 5 步生命周期（基础版）

1. 实例化（调用无参构造）
2. 属性赋值（依赖注入）
3. 初始化（执行 init 方法）
4. 使用中
5. 销毁（执行 destroy 方法）

配置初始化/销毁方法：

```xml
<bean id="userDao" class="com.example.UserDaoImpl"
      init-method="init" destroy-method="destroy"/>
```

```java
public class UserDaoImpl {
    public void init() {
        System.out.println("初始化，建立数据库连接池");
    }
    public void destroy() {
        System.out.println("销毁，释放数据库连接池");
    }
}
```

注解方式（推荐）：

```java
@Component
public class UserDaoImpl {
    @PostConstruct  // 相当于 init-method
    public void init() {}
    
    @PreDestroy     // 相当于 destroy-method
    public void destroy() {}
}
```

> 坑点：`destroy-method` 只在 singleton Bean 的容器关闭（`ctx.close()`）时触发。prototype 作用域的 Bean，Spring 不会调用其销毁方法。如果测试时没有手动调用 `ctx.close()`，销毁方法不会执行。
>

### 7 步生命周期（加入 BeanPostProcessor）

在 5 步基础上，如果容器中注册了 BeanPostProcessor，则在初始化方法前后各插入一步：

1. 实例化
2. 属性赋值
3. **BeanPostProcessor#postProcessBeforeInitialization**
4. 初始化（init 方法）
5. **BeanPostProcessor#postProcessAfterInitialization**
6. 使用中
7. 销毁

BeanPostProcessor 作用于容器中**所有** Bean，常见用途：AOP 代理对象的生成就是在 `postProcessAfterInitialization` 中完成的。

```java
@Component
public class MyBeanPostProcessor implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        // 初始化之前的处理
        return bean;
    }
    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        // 初始化之后的处理，AOP 代理在这里生成
        return bean;
    }
}
```

### 10 步生命周期（加入 Aware 接口回调）

Spring 在 BeanPostProcessor 之前还会回调若干 Aware 接口：

1. 实例化
2. 属性赋值
3. BeanNameAware#setBeanName（注入 Bean 在容器中的名称）
4. BeanClassLoaderAware#setBeanClassLoader（注入类加载器）
5. BeanFactoryAware#setBeanFactory（注入 BeanFactory）
6. EnvironmentAware、ResourceLoaderAware 等其他 Aware 回调
7. BeanPostProcessor#postProcessBeforeInitialization
8. InitializingBean#afterPropertiesSet（可替代 init-method）
9. init-method
10. BeanPostProcessor#postProcessAfterInitialization
11. 使用中
12. DisposableBean#destroy（可替代 destroy-method）
13. destroy-method

实现 Aware 接口示例：

```java
@Component
public class MyService implements ApplicationContextAware {
    private ApplicationContext ctx;
    
    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        this.ctx = applicationContext;
    }
}
```

> SpringBoot 适配：@PostConstruct / @PreDestroy 在 SpringBoot 中同样有效，是推荐写法。XML 的 init-method/destroy-method 在 SpringBoot 中也可通过 @Bean(initMethod="xxx", destroyMethod="xxx") 等价配置。
>

## 3.3 Bean 的实例化方式

Spring 提供了多种 Bean 实例化策略，适应不同场景。

### 无参构造方法（默认）

最常见的方式，Spring 反射调用无参构造方法：

```xml
<bean id="user" class="com.example.User"/>
```

### 静态工厂方法

让工厂类的静态方法来创建 Bean，适用于需要控制创建逻辑的场景：

```java
public class UserFactory {
    public static User createUser() {
        return new User("default");
    }
}
```

```xml
<!-- factory-method 指定静态方法名，class 是工厂类 -->
<bean id="user" class="com.example.UserFactory" factory-method="createUser"/>
```

### 实例工厂方法

先创建工厂 Bean 实例，再通过实例方法创建目标 Bean：

```java
public class UserFactory {
    public User createUser() {
        return new User("from factory");
    }
}
```

```xml
<bean id="userFactory" class="com.example.UserFactory"/>
<bean id="user" factory-bean="userFactory" factory-method="createUser"/>
```

### FactoryBean 接口

实现 `org.springframework.beans.factory.FactoryBean<T>` 接口，Spring 会自动识别并调用 `getObject()` 的返回值作为最终 Bean：

```java
@Component
public class MyFactoryBean implements FactoryBean<User> {
    @Override
    public User getObject() {
        return new User("from FactoryBean");
    }
    @Override
    public Class<?> getObjectType() {
        return User.class;
    }
    @Override
    public boolean isSingleton() {
        return true;
    }
}
```

注意区别：

+ `getBean("myFactoryBean")` → 返回 `User` 对象（getObject() 的返回值）
+ `getBean("&myFactoryBean")` → 返回 `MyFactoryBean` 本身（加 `&` 前缀）

FactoryBean 是 Spring 集成第三方框架的常用手段，如 MyBatis 的 `SqlSessionFactoryBean`、Hibernate 的 `LocalSessionFactoryBean` 都是这个模式。

> 坑点：注意区分 `BeanFactory` 和 `FactoryBean`——`BeanFactory` 是 IoC 容器的顶层接口（工厂），`FactoryBean` 是一个特殊的 Bean（产品），它能让开发者自定义 Bean 的创建逻辑。调用 `getBean("xxx")` 拿到的是 FactoryBean 产出的对象；加 `&` 前缀 `getBean("&xxx")` 才能拿到 FactoryBean 本身。
>

> SpringBoot 适配：FactoryBean 在 SpringBoot 中同样有效，实际开发中用于集成 MyBatis、Quartz 等场景。
>

> 坑点（Date 注入格式问题）：`java.util.Date` 在 Spring XML 中作为简单类型注入时，对日期字符串格式要求极为严格，必须写成 `Mon Oct 10 14:30:26 CST 2025` 这种形式，`2002-10-10` 这样的常规格式无法识别。实际项目中通常通过 FactoryBean 封装日期转换逻辑，或在注解开发中配合 `@DateTimeFormat` 解决。
>

## 3.4 Bean 循环依赖与三级缓存

### 什么是循环依赖

A 依赖 B，B 又依赖 A，这就形成了循环依赖。如果 A 和 B 都使用构造器注入，Spring 无论先创建哪个都会因为另一个未创建完成而报错。

```plain
A -> B -> A  （无限循环，无法完成初始化）
```

### Spring 的解决方案：三级缓存

Spring 针对 **singleton + set 注入**的循环依赖，通过三个 Map 来解决：

+ **一级缓存 singletonObjects**：存放已完全初始化的单例 Bean（可以对外使用的成品）
+ **二级缓存 earlySingletonObjects**：存放提前暴露的 Bean 实例（已实例化但尚未完成依赖注入，可能是代理对象）
+ **三级缓存 singletonFactories**：存放 Bean 的 ObjectFactory（用于生成早期引用，可在此生成 AOP 代理）

解决过程示意：

1. 创建 A，实例化后把 A 的工厂放入三级缓存
2. 对 A 进行属性注入，发现需要 B
3. 创建 B，实例化后把 B 的工厂放入三级缓存
4. 对 B 进行属性注入，发现需要 A
5. 从三级缓存取出 A 的 ObjectFactory，生成 A 的早期引用，放入二级缓存，清除三级缓存中的 A
6. B 完成初始化，放入一级缓存
7. A 的属性注入 B 完成，A 完成初始化，放入一级缓存，清除二级缓存中的 A

为什么需要三级缓存而不是两级？核心原因是 AOP 代理。如果只用两级缓存（成品 + 半成品），当 A 需要被 AOP 代理时：

+ A 实例化后直接放入二级缓存（原始对象）
+ B 依赖 A，从二级缓存拿到的是原始对象
+ A 初始化完成后放入一级缓存的是代理对象 `$ProxyA`
+ B 中持有的仍是原始对象，调用 A 的方法时 AOP 增强逻辑失效

三级缓存的 `ObjectFactory` 在获取早期引用时会判断：需要代理就生成代理对象，不需要就直接返回原始对象。这样 B 注入的就是正确的代理对象，与一级缓存中的最终 Bean 保持一致。

### 无法解决的循环依赖场景

+ **构造器注入 + 循环依赖**：创建 A 时需要 B，创建 B 时需要 A，但此时 A 连实例都没有（构造方法都没跑完），三级缓存机制无从介入。Spring 6 之后，遇到构造器循环依赖会直接抛出 BeanCurrentlyInCreationException，不会尝试解决
+ **prototype 作用域 + 循环依赖**：prototype Bean 不存入缓存，Spring 无法提前暴露引用，因此 prototype 之间的循环依赖也无法解决

> 坑点：Spring Boot 2.6+ 默认**禁止**循环依赖，如果项目中存在循环依赖会在启动时报错。如需临时允许（不推荐），在 application.properties 中设置 `spring.main.allow-circular-references=true`。根本解决方案是重构代码：将公共依赖抽取到第三个类，或将其中一个依赖改为懒注入（`@Lazy`）。
>

## 3.5 GoF 工厂模式

这一节梳理三种工厂模式的区别，有助于理解 Spring 自身的设计。

### 简单工厂模式（静态工厂）

用一个静态方法根据参数决定创建哪种对象。客户端不直接 new，但工厂和产品高度耦合——每增加一种产品就要修改工厂方法，违反 OCP。

```java
public class ShapeFactory {
    public static Shape create(String type) {
        if ("circle".equals(type)) return new Circle();
        if ("square".equals(type)) return new Square();
        throw new IllegalArgumentException("未知类型");
    }
}
```

Spring 应用：`BeanFactory.getBean("beanName")` 就是简单工厂的体现。

### 工厂方法模式

将工厂本身抽象为接口，每种产品对应一个具体工厂。增加产品时只需新增工厂类，符合 OCP，但工厂类数量随产品增多。

```java
public interface ShapeFactory {
    Shape create();
}
public class CircleFactory implements ShapeFactory {
    public Shape create() { return new Circle(); }
}
public class SquareFactory implements ShapeFactory {
    public Shape create() { return new Square(); }
}
```

Spring 应用：XML 中的 `factory-method`（实例工厂）体现的就是工厂方法模式；`FactoryBean` 也是这个模式的体现。

### 抽象工厂模式

在工厂方法基础上，定义一个能生产**一族相关产品**的工厂接口。适用于需要保证产品族内兼容性的场景（如 UI 换肤：一套皮肤包含 Button、TextBox、ScrollBar 等组件）。

```java
public interface GUIFactory {
    Button createButton();
    TextBox createTextBox();
}
public class DarkThemeFactory implements GUIFactory {
    public Button createButton() { return new DarkButton(); }
    public TextBox createTextBox() { return new DarkTextBox(); }
}
```

Spring 应用：`ApplicationContext` 可以看作抽象工厂，它可以生产各种不同类型的 Bean。

---
