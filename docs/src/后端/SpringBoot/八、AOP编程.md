

## 8.1 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

引入后会自动引入aop依赖和aspectj依赖：
- **aop依赖**：纯Spring AOP实现
- **aspectj依赖**：功能更强大的第三方AOP框架（推荐）

## 8.2 核心概念

| 概念 | 说明 |
|------|------|
| **切面(Aspect)** | 横切关注点的模块化，包含通知和切入点 |
| **通知(Advice)** | 切面在特定连接点执行的动作 |
| **切入点(Pointcut)** | 匹配连接点的表达式 |
| **连接点(JoinPoint)** | 程序执行过程中的某个点，如方法调用 |
| **目标对象(Target)** | 被代理的原始对象 |

## 8.3 通知类型

| 注解 | 说明 |
|------|------|
| `@Before` | 前置通知，方法执行前 |
| `@After` | 后置通知，方法执行后（无论是否异常） |
| `@AfterReturning` | 返回通知，方法成功返回后 |
| `@AfterThrowing` | 异常通知，方法抛出异常后 |
| `@Around` | 环绕通知，包裹方法执行 |

## 8.4 切入点表达式

```java
// 匹配service包下所有类的所有方法
@Before("execution(* com.example.service..*.*(..))")

// 匹配指定类的方法
@Before("execution(* com.example.service.UserService.*(..))")

// 匹配以save开头的方法
@Before("execution(* com.example.service.*.save*(..))")

// 匹配第一个参数为String的方法
@Before("execution(* com.example.service.*.*(String, ..))")

// 使用@annotation匹配标注了特定注解的方法
@Before("@annotation(com.example.annotation.Log)")

// 组合表达式
@Before("execution(* com.example.service..*.*(..)) && @annotation(log)")
```

## 8.5 完整示例

```java
@Component  // 纳入IoC容器
@Aspect     // 声明为切面类
public class LogAspect {

    // 定义切入点（复用）
    @Pointcut("execution(* com.example.service..*.*(..))")
    public void servicePointcut() {}

    // 前置通知
    @Before("servicePointcut()")
    public void beforeLog(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        System.out.println("[LOG] 方法 " + methodName + " 开始执行，参数：" + Arrays.toString(args));
    }

    // 后置返回通知
    @AfterReturning(pointcut = "servicePointcut()", returning = "result")
    public void afterReturningLog(JoinPoint joinPoint, Object result) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("[LOG] 方法 " + methodName + " 执行成功，返回值：" + result);
    }

    // 异常通知
    @AfterThrowing(pointcut = "servicePointcut()", throwing = "ex")
    public void afterThrowingLog(JoinPoint joinPoint, Exception ex) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("[LOG] 方法 " + methodName + " 抛出异常：" + ex.getMessage());
    }

    // 环绕通知
    @Around("servicePointcut()")
    public Object aroundLog(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        long start = System.currentTimeMillis();
        
        System.out.println("[LOG] 环绕通知：方法 " + methodName + " 开始");
        
        try {
            Object result = joinPoint.proceed();  // 执行目标方法
            long cost = System.currentTimeMillis() - start;
            System.out.println("[LOG] 环绕通知：方法 " + methodName + " 结束，耗时 " + cost + "ms");
            return result;
        } catch (Exception e) {
            System.out.println("[LOG] 环绕通知：方法 " + methodName + " 异常");
            throw e;
        }
    }
}
```

## 8.6 自定义注解实现AOP

定义注解：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
    String value() default "";
    boolean printParams() default true;
}
```

切面类：

```java
@Component
@Aspect
public class LogAnnotationAspect {

    @Around("@annotation(log)")
    public Object around(ProceedingJoinPoint joinPoint, Log log) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String desc = log.value();
        
        System.out.println("[LOG] " + desc + " - 方法：" + methodName);
        
        if (log.printParams()) {
            System.out.println("[LOG] 参数：" + Arrays.toString(joinPoint.getArgs()));
        }
        
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long cost = System.currentTimeMillis() - start;
        
        System.out.println("[LOG] 耗时：" + cost + "ms");
        return result;
    }
}
```

使用注解：

```java
@Service
public class UserService {
    
    @Log("保存用户")
    public void saveUser(User user) {
        // 业务逻辑
    }
}
```

## 8.7 常见应用场景

1. **日志记录**：记录方法入参、返回值、执行时间
2. **权限校验**：方法执行前检查用户权限
3. **事务管理**：统一控制事务边界
4. **性能监控**：统计方法执行耗时
5. **异常处理**：统一捕获和处理异常
6. **缓存控制**：方法级缓存的添加和清除
