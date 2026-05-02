

## 6.1 AOP 的本质与优势

AOP（Aspect-Oriented Programming，面向切面编程）是对 OOP 的补充延伸，底层基于动态代理实现。

在一个系统中，日志、事务、权限校验等逻辑天然地存在于所有业务方法中——这些代码叫做**交叉业务**。如果把它们散落在每个业务方法里，会带来两个问题：代码重复且修改成本高；程序员无法专注核心业务。

AOP 的解决思路：**将交叉业务代码独立抽取为一个组件（切面），以横向交叉的方式织入目标对象的方法调用链中**，而不侵入业务代码本身。

AOP 的三大优势：

+ 代码复用：横切逻辑只写一次
+ 易维护：修改横切逻辑只需改一处
+ 关注分离：业务代码只关注业务

## 6.2 AOP 七大术语

| 术语 | 说明 |
| --- | --- |
| 连接点 Joinpoint | 程序执行中可以插入切面的位置，如方法执行前、返回后、抛出异常时等 |
| 切点 Pointcut | 用表达式描述"在哪些连接点织入"，本质是一个位置匹配规则 |
| 通知 Advice | 在切点处执行的增强逻辑代码（要切入的具体代码） |
| 切面 Aspect | 切点 + 通知的组合，即"在哪里执行什么逻辑"的完整描述 |
| 织入 Weaving | 将切面应用到目标对象、生成代理对象的过程 |
| 代理对象 Proxy | 被 AOP 增强后产生的代理对象，客户端实际使用的是它 |
| 目标对象 Target | 原始的被增强对象，包含核心业务逻辑 |


切点和连接点的关系：连接点是所有可插入的位置（集合），切点是我们选择要插入的那些位置（子集）。

## 6.3 切点表达式

Spring AOP 支持多种切点表达式语法，最常用的是 `execution`。

### execution 表达式语法

```plain
execution([访问修饰符] 返回值类型 [全限定类名]方法名(参数列表) [异常])
```

各部分说明：

+ 访问修饰符：可选，省略则匹配任意访问权限
+ 返回值类型：必填，`*` 表示任意类型
+ 全限定类名：可选，省略则匹配所有类；`..` 表示当前包及其所有子包
+ 方法名：必填，`*` 表示所有方法，`set*` 表示所有 set 开头的方法
+ 参数列表：必填，`()` 无参，`(..)` 任意参数，`(*)` 恰好一个任意类型参数，`(String, *)` 第一个参数为 String

常用示例：

```plain
// service 包下所有类的所有 public 方法
execution(public * com.example.service.*.*(..))

// service 包及其子包下所有类的所有方法
execution(* com.example.service..*(..))

// OrderService 类中所有以 delete 开头的 public 方法
execution(public * com.example.service.OrderService.delete*(..))

// 匹配所有方法（慎用，范围过大）
execution(* *(..))
```

### @annotation 表达式

匹配被特定注解标注的方法：

```plain
@annotation(com.example.annotation.Log)
```

只要方法上有 `@Log` 注解，就会被切入。

### within 表达式

匹配特定类型下的所有方法（不支持方法级精确匹配）：

```plain
within(com.example.service.*)
within(com.example.service..*)
```

## 6.4 通知类型（5 种）

Spring AOP 提供五种通知，对应方法执行生命周期的不同阶段：

| 注解 | 说明 |
| --- | --- |
| @Before | 前置通知：目标方法执行之前 |
| @After | 后置通知：目标方法结束后，无论是否抛出异常都执行 |
| @AfterReturning | 返回通知：目标方法正常返回后执行，若抛出未捕获异常则不执行 |
| @AfterThrowing | 异常通知：目标方法抛出未捕获异常后执行 |
| @Around | 环绕通知：目标方法执行前后都可介入，可以控制是否执行目标方法 |


执行顺序（正常情况）：

```plain
@Around 前半 → @Before → 目标方法 → @AfterReturning → @After → @Around 后半
```

执行顺序（异常情况，且异常未被捕获）：

```plain
@Around 前半 → @Before → 目标方法（抛异常）→ @AfterThrowing → @After
（@AfterReturning 不执行，@Around 后半不执行）
```

执行顺序（异常情况，但异常在环绕通知中被捕获）：

```plain
@Around 前半 → @Before → 目标方法（抛异常）→ @AfterThrowing → @After → @Around 后半
（@Around 后半会执行，@AfterReturning 不执行）
```

环绕通知示例：

```java
@Around("execution(* com.example.service.*.*(..))")
public Object aroundAdvice(ProceedingJoinPoint pjp) throws Throwable {
    System.out.println("环绕前");
    Object retValue = pjp.proceed();  // 执行目标方法
    System.out.println("环绕后");
    return retValue;
}
```

`ProceedingJoinPoint` 是 `JoinPoint` 的子接口，只有 `@Around` 可以使用它。调用 `pjp.proceed()` 才会真正执行目标方法，不调用则目标方法被拦截。

返回通知获取返回值：

```java
@AfterReturning(value = "execution(* com.example.service.*.*(..))", returning = "result")
public void afterReturning(Object result) {
    System.out.println("返回值：" + result);
}
```

异常通知获取异常：

```java
@AfterThrowing(value = "execution(* com.example.service.*.*(..))", throwing = "ex")
public void afterThrowing(Exception ex) {
    System.out.println("异常信息：" + ex.getMessage());
}
```

## 6.5 @Pointcut 切点复用

当多个通知使用相同的切点表达式时，可以用 `@Pointcut` 定义一次，引用多次：

```java
@Aspect
@Component
public class LogAspect {

    // 定义切点，方法名任意，方法体为空
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void servicePointcut() {}

    @Before("servicePointcut()")
    public void before() {}

    @After("servicePointcut()")
    public void after() {}

    @AfterReturning("servicePointcut()")
    public void afterReturning() {}
}
```

跨切面类引用切点：

```java
// 在其他切面类中引用，需要写全限定方法名
@Before("com.example.aspect.LogAspect.servicePointcut()")
public void before() {}
```

## 6.6 基于 AspectJ 的 AOP 注解式开发

Spring 的 AOP 功能借助 AspectJ 框架的注解语法实现，需要引入 spring-aspects 依赖：

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-aspects</artifactId>
    <version>6.2.13</version>
</dependency>

```

### 配置切面类

```java
@Aspect        // 声明这是一个切面类
@Component     // 纳入 Spring 容器管理
@Order(1)      // 多个切面时，数字越小优先级越高
public class TransactionAspect {

    @Pointcut("execution(* com.example.service..*(..))")
    public void txPointcut() {}

    @Around("txPointcut()")
    public Object around(ProceedingJoinPoint pjp) {
        Object retValue = null;
        try {
            System.out.println("开启事务");
            retValue = pjp.proceed();
            System.out.println("提交事务");
        } catch (Throwable e) {
            System.out.println("回滚事务");
        }
        return retValue;
    }
}
```

### XML 配置方式开启 AOP

```xml
<!-- 开启组件扫描 -->
<context:component-scan base-package="com.example"/>
<!-- 开启 AOP 自动代理，proxy-target-class="true" 表示使用 CGLIB -->
<aop:aspectj-autoproxy proxy-target-class="true"/>
```

### 全注解方式开启 AOP

```java
@Configuration
@ComponentScan("com.example")
@EnableAspectJAutoProxy(proxyTargetClass = true)  // 开启 AOP，等价于 XML 的 aop:aspectj-autoproxy
public class SpringConfig {}
```

> SpringBoot 适配：SpringBoot 引入了 `spring-boot-starter-aop` 依赖后，自动开启 AspectJ 代理，无需手动 `@EnableAspectJAutoProxy`。在切面类上加 `@Aspect` + `@Component` 即可生效。
>

## 6.7 多切面执行顺序（@Order）

当多个切面切入同一个目标方法时，通过 `@Order` 注解控制优先级，数字越小越先执行（包裹在外层）：

```java
@Aspect
@Component
@Order(1)  // 优先级最高，在最外层
public class SecurityAspect {}

@Aspect
@Component
@Order(2)  // 优先级较低，在内层
public class LogAspect {}
```

执行顺序类比嵌套的 try-catch：

+ 正常：SecurityAspect 前 → LogAspect 前 → 目标方法 → LogAspect 后 → SecurityAspect 后
+ 异常：SecurityAspect 前 → LogAspect 前 → 目标方法抛异常 → LogAspect 异常通知 → SecurityAspect 异常通知 → （异常继续向上）

## 6.8 XML 配置 AOP（了解）

XML 方式不依赖注解，在纯 XML 项目中使用。了解结构即可，实际开发用注解方式：

```xml
<aop:config>
    <!-- 切点定义 -->
    <aop:pointcut id="txPointcut" 
                  expression="execution(* com.example.service..*(..))"/>
    <!-- 切面定义 -->
    <aop:aspect ref="transactionAspect">
        <aop:around method="around" pointcut-ref="txPointcut"/>
        <aop:before  method="before" pointcut-ref="txPointcut"/>
        <aop:after   method="after"  pointcut-ref="txPointcut"/>
    </aop:aspect>
</aop:config>
<bean id="transactionAspect" class="com.example.aspect.TransactionAspect"/>
```

> 坑点合集：
>
> + 切面类本身不能被代理自己切入（否则无限递归），Spring 会自动处理避免这种情况
> + `@Around` 通知中必须调用 `pjp.proceed()` 并返回其返回值，否则目标方法被阻断且调用方拿不到正确返回值
> + `@AfterThrowing` 不会捕获异常，它只是观察异常，异常仍会继续向上传播；若要捕获并处理异常，应在 `@Around` 中使用 try-catch
> + Spring AOP 是基于代理的，同一类内部方法 A 调用方法 B，B 上的 AOP 不会生效（因为 A 调用的是 `this.B()`，不经过代理对象）
>

---
