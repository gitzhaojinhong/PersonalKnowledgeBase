## 第五章 GoF 代理模式

## 5.1 代理模式概念

代理模式属于 GoF 23 种设计模式中的结构型模式。核心思想是：为目标对象提供一个代理，客户端通过代理间接访问目标对象。

代理模式的典型用途：

+ **功能增强**：在目标方法前后插入日志、性能统计等额外逻辑，不修改原始代码
+ **访问控制**：在代理层做权限校验、登录检查，保护目标对象
+ **代码复用**：将横切逻辑集中在代理中，避免在每个业务类中重复编写

代理模式的三个角色：

+ 抽象主题（接口）：代理类和目标类共同实现的接口，保证客户端感知不到差异
+ 目标类（真实主题）：被代理的原始类，包含核心业务逻辑
+ 代理类：持有目标类的引用，在调用目标方法的前后加入增强逻辑

## 5.2 静态代理

静态代理由开发者手动编写代理类，每个代理类对应一个被代理的接口。

```java
// 公共接口
public interface OrderService {
    void generate();
    void modify();
}

// 目标类
public class OrderServiceImpl implements OrderService {
    public void generate() { System.out.println("订单已生成"); }
    public void modify()   { System.out.println("订单已修改"); }
}

// 代理类：统计耗时，不修改原始类
public class OrderServiceProxy implements OrderService {
    private OrderService target;  // 持有目标对象引用

    public OrderServiceProxy(OrderService target) {
        this.target = target;
    }

    public void generate() {
        long begin = System.currentTimeMillis();
        target.generate();  // 调用目标方法
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
    }

    public void modify() {
        long begin = System.currentTimeMillis();
        target.modify();
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
    }
}
```

使用方式：

```java
OrderService proxy = new OrderServiceProxy(new OrderServiceImpl());
proxy.generate();
```

静态代理符合 OCP（不修改目标类），并且采用关联关系而非继承，耦合度低。但缺点是：每个接口都需要编写一个代理类，接口多了会引发类爆炸。动态代理解决了这个问题。

## 5.3 动态代理

动态代理在程序运行时在内存中动态生成代理类字节码，无需手动编写代理类。一套代理逻辑可以复用于所有接口/类。

### JDK 动态代理

JDK 动态代理只能代理实现了接口的类（因为生成的代理类本身继承了 Proxy，Java 不支持多重继承，所以只能通过接口来约束）。

核心 API：`java.lang.reflect.Proxy.newProxyInstance()`

```java
// InvocationHandler：代理逻辑的实现
public class TimerInvocationHandler implements InvocationHandler {
    private Object target;  // 目标对象

    public TimerInvocationHandler(Object target) {
        this.target = target;
    }

    // 当调用代理对象的任意方法时，此 invoke 会被触发
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        long begin = System.currentTimeMillis();
        Object retValue = method.invoke(target, args);  // 反射调用目标方法
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
        return retValue;
    }
}
```

创建代理对象：

```java
OrderService target = new OrderServiceImpl();
OrderService proxy = (OrderService) Proxy.newProxyInstance(
    target.getClass().getClassLoader(),    // 类加载器
    target.getClass().getInterfaces(),     // 代理类要实现的接口
    new TimerInvocationHandler(target)     // 调用处理器
);
proxy.generate(); // 实际调用 TimerInvocationHandler.invoke()
```

`newProxyInstance` 三个参数：

+ 类加载器：用于将内存中生成的代理类字节码加载到 JVM
+ 接口数组：代理类需要实现的接口列表
+ InvocationHandler：每次调用代理方法时触发的回调

### CGLIB 动态代理

CGLIB（Code Generation Library）通过继承目标类并重写方法的方式生成代理，可以代理没有接口的类。底层使用字节码操作框架 ASM，性能比 JDK 动态代理略好。

限制：目标类不能是 `final` 修饰的（无法被继承），目标方法也不能是 `final`/`private`（无法被重写）。

```java
// 目标类（无接口）
public class UserService {
    public void login() { System.out.println("用户登录"); }
}

// 方法拦截器（类似 InvocationHandler）
public class TimerMethodInterceptor implements MethodInterceptor {
    @Override
    public Object intercept(Object proxy, Method method, Object[] args, MethodProxy methodProxy)
            throws Throwable {
        long begin = System.currentTimeMillis();
        Object retValue = methodProxy.invokeSuper(proxy, args);  // 调用父类方法（目标方法）
        System.out.println("耗时：" + (System.currentTimeMillis() - begin) + "ms");
        return retValue;
    }
}
```

创建 CGLIB 代理：

```java
Enhancer enhancer = new Enhancer();
enhancer.setSuperclass(UserService.class);           // 继承目标类
enhancer.setCallback(new TimerMethodInterceptor());  // 设置拦截器
UserService proxy = (UserService) enhancer.create();
proxy.login();
```

> 注意：JDK 17+ 使用 CGLIB 时需要添加 JVM 启动参数开放模块访问权限：  
`--add-opens java.base/java.lang=ALL-UNNAMED`
>

### JDK 代理 vs CGLIB 代理

| 对比项 | JDK 动态代理 | CGLIB 动态代理 |
| --- | --- | --- |
| 代理目标 | 必须有接口 | 接口和无接口类均可 |
| 实现机制 | 实现接口 | 继承目标类 |
| 限制 | 目标类需实现接口 | 目标类/方法不能是 final |
| 性能 | 略低（反射调用） | 略高（字节码调用） |


**Spring 的选择策略**：Spring 5+ 默认统一使用 CGLIB 代理。也可通过配置强制使用 JDK：`proxy-target-class="false"`（只在目标类有接口时生效）。Spring AOP 只能代理 `public` 方法，非 public 的方法不会被代理。

> SpringBoot 适配：SpringBoot 默认 `spring.aop.proxy-target-class=true`，即所有 AOP 代理均使用 CGLIB，无论目标类是否有接口。如果希望强制 JDK 代理，设置为 `false`（不推荐，会导致需要通过接口类型获取 Bean）。
>

---
