## AOP面向切面编程

## 概览

Spring AOP 是 Spring 框架中用于将横切关注点（如事务管理、日志记录、权限校验）从业务逻辑中剥离并模块化的解决方案。它通过运行时代理机制，使得开发者可以在不侵入业务代码的前提下，将通用逻辑织入到目标方法执行的前后、异常处或返回时。这一机制构成了 Spring 声明式事务管理、缓存抽象、安全控制等高层功能的底层基础。

### 动态代理

**JDK 动态代理**内置于 JDK 标准库中。其核心机制是在运行期动态生成一个实现了目标接口的代理类，它只能代理接口中声明的方法，无法代理目标类中定义的、但未在接口中出现的方法，也无法代理那些未实现接口的类。

**CGLIB 代理**（Code Generation Library）是一个高性能的字节码生成库。其核心机制是通过 ASM 字节码操纵框架，在运行期动态生成目标类的子类作为代理，并重写其中非 final、非 private 的方法。CGLIB 的优势在于不受接口限制，可以对任意类进行代理，但代价是它无法代理 `final` 类以及 `final` 或 `private` 方法，因为这些成员无法被子类继承和重写。

> **代理方式的选择演进**：在传统的 Spring 框架中，当目标类实现接口时默认使用 JDK 动态代理是长期以来的最佳实践。但从 Spring Boot 2.0 开始，Spring 团队将默认策略转向了 CGLIB，这一转变的主要考量在于：现代应用开发中大量使用注解驱动的 AOP（如 `@Transactional`、`@Cacheable`），CGLIB 可以代理类中所有方法而不仅限于接口方法，且能够避免因接口定义不完整而导致的代理失效问题，同时简化了自调用问题的处理逻辑。

### AOP声明风格选型

框架选型：

| 决策维度 | Spring AOP | 完整 AspectJ |
| --- | --- | --- |
| 目标对象范围 | 仅 Spring 管理的 Bean | 任意对象 |
| 支持连接点 | 仅方法执行 | 方法、字段、构造函数、控制流等 |
| 织入方式 | 运行时代理 | 编译时/加载时/运行时织入 |
| 自调用问题 | 存在，this 调用绕过代理 | 不存在，字节码层面织入 |
| 构建复杂度 | 低，无需额外工具 | 高，需引入 AJC 编译器或 LTW |
| 适用场景 | 多数企业级应用 | 需拦截非托管对象或字段级连接点时 |

> [在 Spring 应用程序中使用 AspectJ](https://docs.spring.io/spring-framework/reference/6.2/core/aop/using-aspectj.html)

Spring AOP风格：

| 决策维度 | @AspectJ 注解风格 | XML 配置风格 |
| --- | --- | --- |
| 模块化 | 高，切面完整封装于一个类 | 低，逻辑分散在 Java 类和 XML 中 |
| 切入点组合 | 支持 &&、||、! 组合命名切入点 | 不支持组合 |
| 实例化模型 | 支持单例、perthis、pertarget 等 | 仅支持单例 |
| 与 AspectJ 兼容 | 完全兼容，可无缝迁移 | 不兼容 |
| 配置可见性 | 分散在各切面类中 | 集中在一处，便于独立调整 |
| 推荐场景 | 自定义切面、复杂横切逻辑 | 纯声明式企业服务配置 |

## AOP注解方式

### 启用@AspectJ支持

在 `@Configuration` 类上标注 `@EnableAspectJAutoProxy` 注解。

> 在 Spring Boot 项目中， 无需手动添加 `@EnableAspectJAutoProxy`

### 声明切面

切面本质上就是一个被 `@Aspect` 注解标注的普通 Java 类。

```java
@Aspect //标注该类是一个切面类
@Component //让Spring识别并使用这个切面
public class MonitoringAspect {
    // 切入点、通知定义
}

```

> **在 Spring AOP 中，切面本身不能成为其他切面的通知目标**。`@Aspect` 注解在类上的标识会将其排除在自动代理机制之外。这意味着，你不能编写一个切面来拦截另一个切面中定义的方法，也不能为切面类本身的方法添加事务管理、缓存等横切逻辑。

### 声明切入点

**切入点结构**

切入点声明由两部分组成：**切入点签名**和**切入点表达式**。切入点签名是一个返回 `void` 的空方法，方法名即切入点的名称；切入点表达式通过 `@Pointcut` 注解的值指定，决定了哪些方法执行会被匹配。以下示例定义了一个名为 `anyOldTransfer` 的切入点，匹配所有名为 `transfer` 的方法：

```java
@Pointcut("execution(* transfer(..))") // 切入点表达式
private void anyOldTransfer() {}       // 切入点签名
```

切入点签名可以是 `private`、`protected` 或 `public`，其可见性不影响切入点匹配，只影响在哪些类中可以引用该切入点。

**切入点指示符**

1. **`execution`**——最核心的指示符，用于匹配方法执行连接点。其完整格式为：

```java
execution(修饰符模式? 返回类型模式 声明类型模式?方法名模式(参数模式) 异常模式?)
```

其中返回类型模式、方法名模式和参数模式是必填项，其余可省略。`*` 匹配任意返回类型，`(..)` 匹配任意数量参数，`(*)` 匹配单个任意类型参数，`(*, String)` 匹配两个参数且第二个为 String 类型。

2. **`within`**——将匹配限制在指定类型内声明的方法。例如 `within(com.xyz.service.*)` 匹配 service 包中所有类的方法，`within(com.xyz.service..*)` 则包含子包。
3. **`this` 与 `target`**——两者在 Spring AOP 的代理机制下有重要区别。`this` 匹配代理对象本身是给定类型的实例，而 `target` 匹配被代理的目标对象是给定类型的实例。在原生 AspectJ 中两者指向同一对象，但在 Spring 的代理式 AOP 中，代理对象和目标对象是分离的，这一区别至关重要。
4. **`args`**——匹配方法运行时参数是给定类型的实例，与 `execution` 的静态参数类型匹配不同，`args` 基于运行时实际传入的参数类型进行匹配。例如 `args(java.io.Serializable)` 匹配运行时传入的参数实现了 Serializable 接口的方法，而 `execution(* *(java.io.Serializable))` 要求方法签名中声明的参数类型为 Serializable。
5. **`@target`、`@within`、`@annotation`、`@args`——这四个指示符基于注解进行匹配，分别对应：目标对象的类**标注了指定注解、目标对象的**声明类型**标注了指定注解、**方法本身**标注了指定注解、**运行时参数类型**标注了指定注解。例如 `@annotation(org.springframework.transaction.annotation.Transactional)` 匹配所有标注了 `@Transactional` 的方法。
6. **`bean`**——Spring AOP 特有的指示符，非 AspectJ 标准。它基于 Spring Bean 的名称进行匹配，支持 `*` 通配符。例如 `bean(tradeService)` 匹配名为 tradeService 的 Bean，`bean(*Service)` 匹配所有名称以 Service 结尾的 Bean。`bean` PCD 在实例级别而非类型级别操作，是 Spring 代理式 AOP 框架与 Spring Bean 工厂紧密集成的产物，在原生 AspectJ 织入中不可用。

**切入点表达式**

切入点表达式可以通过逻辑运算符进行组合：`&&`（与）、`||`（或）、`!`（非）。更关键的是，切入点表达式可以按名称引用其他已命名的切入点，从而构建层次化的切入点定义：

```java
@Pointcut("execution(public * *(..))")
public void publicMethod() {}

@Pointcut("within(com.xyz.trading..*)")
public void inTrading() {}

@Pointcut("publicMethod() && inTrading()")
public void tradingOperation() {}
```

**共享命名切入点定义->最佳实践**

在企业级应用中，多个切面往往需要引用同一组切入点（如服务层、数据访问层、Web 层的划分）。推荐的做法是将常用的命名切入点定义集中在一个独立的公共类中，例如：

```java
public class CommonPointcuts {
    
    @Pointcut("execution(* com.xyz..service.*.*(..))")
    public void businessService() {}

    @Pointcut("within(com.xyz.web..*)")
    public void inWebLayer() {}

    @Pointcut("within(com.xyz.service..*)")
    public void inServiceLayer() {}

    @Pointcut("execution(* com.xyz.dao.*.*(..))")
    public void dataAccessOperation() {}
}
```

其他切面通过全限定类名引用：`@Before("com.xyz.CommonPointcuts.businessService()")`。

### 声明通知

1. **前置通知（`@Before`）**——在匹配的方法执行前运行，但无法阻止方法继续执行（除非抛出异常）。适用于参数校验、前置日志、权限检查等场景。切入点表达式既可以是内联的，也可以引用已命名的切入点：

```java
@Before("execution(* com.xyz.dao.*.*(..))")
public void doAccessCheck() {
    // ...
}
```

2. **后置返回通知（`@AfterReturning`）**——在方法正常返回后运行。可以通过 `returning` 属性绑定返回值，同时该属性还会将匹配限制为仅返回指定类型的方法：

```java
@AfterReturning(
    pointcut = "execution(* com.xyz.dao.*.*(..))",
    returning = "retVal")
// 需要注意的是，后置返回通知无法返回一个完全不同的引用——它只能观测到返回值，但不能替换它。
public void doAccessCheck(Object retVal) {
    // retVal 即为方法返回值
}
```

3. **后置抛出通知（`@AfterThrowing`）**——在方法抛出异常后运行。可以通过 `throwing` 属性绑定异常对象并限定异常类型：

```java
@AfterThrowing(
    pointcut = "execution(* com.xyz.dao.*.*(..))",
    throwing = "ex")
public void doRecoveryActions(DataAccessException ex) {
// ex 即为抛出的异常
}
```

> 需特别注意，`@AfterThrowing` 并非一个通用的异常处理回调。它只接收来自连接点（目标方法）本身的异常，而非来自同一切面中其他通知方法（如 `@After` 或 `@AfterReturning`）抛出的异常。

4. **后置最终通知（`@After`）**——无论方法正常返回还是抛出异常，都会执行，其语义等同于 `try-catch` 语句中的 `finally` 块，适用于资源释放等场景：

```java
@After("execution(* com.xyz.dao.*.*(..))")
public void doReleaseLock() {
    // 资源清理
}
```

5. **环绕通知（`@Around`）**——最强大的通知类型，可以完全包围方法的执行。它有能力决定方法何时、如何、甚至是否实际执行。环绕通知的方法必须声明 `Object` 作为返回类型，第一个参数必须为 `ProceedingJoinPoint` 类型，且必须在方法体内调用 `proceed()` 来触发目标方法的执行：

```java
@Around("execution(* com.xyz..service.*.*(..))")
public Object doBasicProfiling(ProceedingJoinPoint pjp) throws Throwable {
    long start = System.currentTimeMillis();
    Object retVal = pjp.proceed();
    long duration = System.currentTimeMillis() - start;
    return retVal;
}
```

> 环绕通知的 `proceed()` 方法可以不带参数（此时使用调用者传入的原始参数），也可以传入一个 `Object[]` 数组来替换原始参数。`proceed()` 可以在方法体内被调用零次、一次或多次，均合法。如果环绕通知的返回类型声明为 `void`，则每次调用都会向调用方返回 `null`，因此官方建议始终将返回类型声明为 `Object`。

***

**访问当前连接点（JoinPoint）**

任何通知方法都可以将 `org.aspectj.lang.JoinPoint` 作为第一个参数声明（环绕通知必须是其子类 `ProceedingJoinPoint`）。`JoinPoint` 接口提供了以下关键方法：

* `getArgs()`——返回方法参数
* `getThis()`——返回代理对象
* `getTarget()`——返回目标对象（被代理的应用对象）
* `getSignature()`——返回被通知方法的描述信息
* `toString()`——打印被通知方法的可读描述

***

**将参数传递给通知**

Spring AOP 支持完全类型化的通知参数绑定，即通知方法中声明的参数类型即为运行时接收到的参数类型，无需处理 `Object[]` 数组。通过 `args` 指示符的绑定形式，可以将方法参数值传递给通知方法：

```java
// args(account,..) 同时实现了两个功能：
// 第一，将匹配限制为至少有一个参数且第一个参数为 Account 类型的方法；
// 第二，将实际的 Account 对象通过 account 参数传递给通知方法。
@Before("execution(* com.xyz.dao.*.*(..)) && args(account,..)")
public void validateAccount(Account account) {
    // account 参数已自动绑定
}
```

同样，`this`（代理对象）、`target`（目标对象）以及 `@within`、`@target`、`@annotation`、`@args` 等注解指示符都可以采用类似的绑定形式。例如，匹配标注了 `@Auditable` 注解的方法并提取注解值：

```java
@Before("com.xyz.Pointcuts.publicMethod() && @annotation(auditable)")
public void audit(Auditable auditable) {
AuditCode code = auditable.value();
// ...
}
```

* 泛型参数的处理：Spring AOP 可以处理类声明和方法参数中的泛型，通过将通知参数绑定到具体的泛型参数类型来实现拦截。但这一方法不适用于泛型集合，例如无法通过 `Collection<MyType>` 来匹配，因为需要检查集合中的每个元素，这在实践中不可行。对于集合参数，应声明为 `Collection<?>` 并在方法体内手动检查元素类型。
* 当通知方法的第一参数为 `JoinPoint`、`ProceedingJoinPoint` 或 `JoinPoint.StaticPart` 类型时，该参数名称可以从 `argNames` 属性中省略，Spring 会自动识别。
* 带参数执行 proceed：在环绕通知中，如果要修改传入目标方法的参数，可以通过 `args` 绑定原始参数，处理后通过 `proceed(new Object[] {newPattern})` 传入修改后的值：

```java
@Around("execution(List<Account> find*(..)) && " +
        "com.xyz.CommonPointcuts.inDataAccessLayer() && " +
        "args(accountHolderNamePattern)")
public Object preProcessQueryPattern(ProceedingJoinPoint pjp,
                                     String accountHolderNamePattern) throws Throwable {
    String newPattern = preProcess(accountHolderNamePattern);
    return pjp.proceed(new Object[] {newPattern});
}
```

***

> **不同切面间的通知顺序**：除非显式指定，否则执行顺序未定义。通过实现 `org.springframework.core.Ordered` 接口或标注 `@Order` 注解来控制优先级，返回 `getOrder()` 值较小的切面具有更高的优先级。高优先级的通知在"进入"时先执行，在"退出"时后执行。

### 引入

"**引入**"允许切面为被通知对象动态添加新的接口及其实现，而无需修改目标类的源代码。

> 例如： 希望所有 Service 层的 Bean 都具备一个 `UsageTracked` 接口，用于记录其被调用的次数。

**引入通过 `@DeclareParents` 注解实现。**

* 该注解标注在一个静态字段上；
* 字段的类型即为要引入的接口类型；
* 注解的 `value` 属性指定哪些类型的目标对象会被引入该接口；
* `defaultImpl` 属性指定接口的默认实现类。

完整的示例：为所有服务层 Bean 引入 `UsageTracked` 接口，并在前置通知中记录使用次数：

```java
@Aspect
public class UsageTracking {


    @DeclareParents(
        value = "com.xyz.service.*+",
        defaultImpl = DefaultUsageTracked.class)
    public static UsageTracked mixin;


    @Before("execution(* com.xyz..service.*.*(..)) && this(usageTracked)")
    public void recordUsage(UsageTracked usageTracked) {
        usageTracked.incrementUseCount();
    }
}
```

> 注意事项：
>
> * 引入的接口实现是共享的默认实现，每个被引入的 Bean 会拥有独立的实例（由 Spring 容器管理）
> * 引入仅作用于通过代理访问的场景，目标对象内部自调用无法使用引入的接口
> * 由于引入改变了代理对象的类型体系，在某些类型检查场景中需要额外注意——例如，`instanceof` 检查会通过，但目标类本身的 `getClass()` 返回的仍然是原始类型

## AOP代理失效场景

### 私有方法调用

私有方法调用：private方法子类无法被重写，CGLIB代理无法拦截

### 静态方法调用

静态方法调用：static方法属于类而非对象，无法通过代理拦截

### final方法调用

final方法调用：final方法无法被子类覆盖，CGLIB代理无法拦截

### 类内部自调用

类内部自调用：类内部直接调用本类方法，指向原对象，不会经过代理对象

### 内部类方法调用

内部类方法调用：直接调用内部类方法，不经过Spring容器管理

## 切面的实例化模型

在默认设置下，每个切面类在整个 Spring 应用上下文中仅存在一个实例。

> 单例模型在无状态切面中表现良好，但当需要在切面中维护每个被代理对象相关的状态时，单例模型就显得力不从心了。
>
> 考虑一个场景：你需要统计每个服务对象被调用的次数，且这个计数器是切面的一部分。如果使用单例模型，所有服务对象共享同一个计数器，无法区分各对象的调用次数。

1. **`perthis` 模型**

`perthis` 模型通过在 `@Aspect` 注解中指定 `perthis` 子句来声明，子句的值是一个切入点表达式：

```java
@Aspect("perthis(execution(* com.xyz..service.*.*(..)))")
public class MyAspect {
    private int someState;

    @Before("execution(* com.xyz..service.*.*(..))")
    public void recordServiceUsage() {
        // ...
    }
}
```

**`perthis` 的行为机制：**

* 每个唯一的服务对象（即代理对象，在匹配的连接点上绑定到 `this` 的对象）都会获得一个独立的切面实例
* 切面实例在第一次在该服务对象上调用匹配方法时创建
* 一旦切面实例创建完成，其内部声明的通知仅在该服务对象的方法调用匹配时执行
* 当服务对象超出作用域时，对应的切面实例也随之销毁

> `perthis` 中的 "this" 指的是**代理对象**。由于 Spring AOP 基于代理机制，`this` 绑定的是代理对象本身。每个代理对象对应一个被代理的 Bean 实例。
>
> **因此 `perthis` 本质上是为每个被代理的 Bean 创建一个独立的切面实例。**
>
> ***

***

2. **`pertarget` 模型**

`pertarget` 模型与 `perthis` 的工作原理完全相同，唯一的区别在于：`pertarget` 为每个唯一的**目标对象**（即被代理的应用对象，而非代理对象）创建独立的切面实例。

在 Spring AOP 的代理机制中，`this` 指向代理对象，而 `target` 指向被代理的目标对象。在大多数情况下，代理对象和目标对象存在一一对应的关系，因此 `perthis` 和 `pertarget` 的行为差异不大。但在某些特殊场景（如使用引入、目标源代理等）下，代理对象与目标对象的关系可能变得复杂，此时选择哪种模型需要根据具体需求确定。

***

3. **`pertypewithin` 模型**

Spring 还支持 `pertypewithin` 实例化模型，它为每个匹配的类型（而非实例）创建一个切面实例。换句话说，同一个类型的所有实例共享同一个切面实例，但不同类型的实例拥有不同的切面实例。这一模型适用于需要基于类型而非实例来维护状态的场景。

## 程序化创建`@AspectJ`代理

程序化创建 @AspectJ 代理提供了一种绕过 Spring 自动代理机制的替代方案，允许开发者通过编码方式直接为任意目标对象创建被 @AspectJ 切面通知的代理实例。

> 在某些场景下，自动代理机制可能无法满足需求。例如，你需要为一个**非 Spring 容器管理**的对象（如通过 `new` 操作符直接创建的对象）应用切面通知，或者需要在运行时根据动态条件决定是否对某个对象进行代理。

**`AspectJProxyFactory` 的核心用法**

`AspectJProxyFactory` 的使用模式非常简洁，遵循三步流程：创建工厂实例、添加切面、获取代理对象。

```java
// 第一步：创建工厂，传入目标对象
AspectJProxyFactory factory = new AspectJProxyFactory(targetObject);

// 第二步：添加切面——支持两种方式
// 方式一：通过切面类添加，工厂会实例化该切面
factory.addAspect(SecurityManager.class);

// 方式二：添加已有的切面实例
factory.addAspect(usageTracker);

// 第三步：获取代理对象
MyInterfaceType proxy = factory.getProxy();
```

## 更底层的 Spring AOP API

| 底层 API | 说明 |
| --- | --- |
| `Pointcut`API | 切入点接口，定义匹配连接点的条件 |
| `Advice` API | 通知接口，定义拦截逻辑（如 `MethodBeforeAdvice`、`AfterReturningAdvice`等） |
| `Advisor`API | 将 Pointcut 与 Advice 组合为完整的切面单元 |
| `ProxyFactoryBean` | 通过 FactoryBean 方式为指定目标 Bean 创建 AOP 代理 |
| `ProxyFactory` | 编程式创建 AOP 代理的核心类 |
| `Advised`接口 | 操作已创建代理的通知列表（运行时添加/移除通知） |
| "auto-proxy" 设施 | `BeanPostProcessor`实现，自动为匹配的 Bean 生成代理 |
| `TargetSource` | 抽象目标对象的获取方式（如池化、热替换等） |

[Spring AOP APIs文档跳转](https://docs.spring.io/spring-framework/reference/6.2/core/aop-api.html)


> 更新: 2026-10-27 10:20:40  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/zmnzi9/segxbl8x6s2vnp3c>