## 类型转换、数据绑定、验证

## 处理流程

```plain
用户输入原始数据（字符串键值对 / JSON 字符串）
    │
    ▼
【Type Conversion 类型转换层】
    将原始字符串转换为 Java 类型
    实现者：PropertyEditor / Converter / Formatter
    │
    ▼
【Data Binding 数据绑定层】
    将转换后的值装配到目标对象的属性上
    核心组件：DataBinder + BeanWrapper
    │
    ▼
【Validation 验证层】
    对绑定完成的对象进行业务规则校验
    实现者：Spring Validator / Bean Validation（@Valid + 约束注解）
    │
    ▼
经过验证的业务对象，进入 Service 层处理

```

## 类型转化

### PropertyEditor

`PropertyEditor` 是 JavaBeans 规范中定义的接口，Spring 早期将其"借用"来完成字符串与 Java 类型之间的转换。`BeanWrapperImpl` 默认注册了多个内置实现（`ClassEditor`、`CustomNumberEditor`、`FileEditor` 等），支持常见类型的 String <=> Object 双向转换。

**核心缺陷：** 线程不安全（有状态，内部持有 `value` 字段），且仅支持 String <=> Object 转换，无法处理任意类型之间的转换。在 Spring 3 引入 `Converter`/`ConversionService` 体系后，`PropertyEditor` 已不再是类型转换的首选方案，但在维护遗留项目时仍需理解其工作原理。

***

### Converter / ConversionService

`org.springframework.core.convert` 包提供了一套通用的类型转换系统，以 `Converter<S, T>` 接口为核心，通过 `ConversionService` 对外提供统一的门面 API。相比 `PropertyEditor`，其核心优势是：**线程安全、强类型、支持任意类型之间的转换**。

> 在 Spring Boot 应用中，`ConversionService` 默认启用且自动配置。`DefaultConversionService` 自动注册了大量内置转换器，覆盖绝大多数常见场景：
>
> * **字符串与数字互转**
> * **字符串与枚举互转**
> * **集合与数组互转**
> * **字符串与 UUID 互转**
>
> **对于绝大多数 Spring Boot 项目，开发者无需编写任何转换器代码，常见的类型转换能够开箱即用。**

**编程式使用**

```java
@Autowired
private ConversionService conversionService;

public void doIt() {
    Integer result = conversionService.convert("123", Integer.class);
    // result = 123
}
```

对于包含泛型参数的复杂类型，需要使用 `TypeDescriptor` 提供完整的类型信息：

```java
DefaultConversionService cs = new DefaultConversionService();
List<Integer> input = Arrays.asList(1, 2, 3);
List<String> output = cs.convert(input,
    TypeDescriptor.forObject(input),
    TypeDescriptor.collection(List.class, TypeDescriptor.valueOf(String.class)));
```

### Formatter

字段格式化`Formatter` 接口是在 `Converter` 类型转换体系之上构建的、专门面向客户端环境（如 Web 应用）的格式化 SPI。其核心特征是：**输入和输出都是 String**，且原生支持**本地化**（`Locale` 参数）。

> 适用场景：用户在前端表单中输入字符串 → 提交到后端 → `Formatter` 解析为 Java 对象 → 后端处理 → `Formatter` 将 Java 对象格式化为字符串返回视图层渲染。这是一个完整的 `String ⇄ Object` 双向过程。

***

**注解驱动方式（最常用）**

日常开发中无需直接实现 `Formatter` 接口，而是通过注解声明式地使用：

> @DateTimeFormat 生效不需要 @Valid，两者分属不同阶段：
>
> @DateTimeFormat 在数据绑定阶段由 FormattingConversionService 处理，
>
> @Valid 触发的约束注解在绑定完成后的验证阶段执行。

```java
public class Event {
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startTime;

    @NumberFormat(style = NumberFormat.Style.CURRENCY)
    private BigDecimal price;

    @NumberFormat(style = NumberFormat.Style.PERCENT)
    private Double discountRate;
}
```

***

**Spring Boot 全局日期格式配置**

通过 `application.yml` 统一配置，无需在每个字段上重复指定 `@DateTimeFormat`：

```yaml
spring:
  mvc:
    format:
      date: yyyy-MM-dd
      date-time: yyyy-MM-dd HH:mm:ss
      time: HH:mm:ss
```

***

### 三种转换方式的对比

| 维度 | PropertyEditor | Converter | Formatter |
| --- | --- | --- | --- |
| 线程安全 | 否，有状态 | 是，无状态 | 是，无状态 |
| 转换范围 | 仅 String <=> Object | 任意类型之间（S → T） | 面向 UI 的 String <=> 对象，双向 |
| 类型信息 | 隐式，无类型参数 | 显式，强类型泛型 | 显式，强类型泛型 |
| Spring Boot 默认注册 | 否 | 是，大量内置转换器 | 是，`@DateTimeFormat`/ `@NumberFormat`的工厂 |
| 推荐程度 | 了解即可 | 需要掌握，自定义类型转换首选 | 需要掌握，UI 格式化首选 |
| 官网文档 |  |  |  |

**实际开发结论：** 三种方式在日常开发中均不常用。最常见的需求（字符串 <=> 数字、字符串 <=> 枚举、字符串 <=> 日期等）已被 Spring Boot 内置的转换器覆盖，开发者无需手动编写任何转换器代码。自定义 `Converter` 或 `Formatter` 仅在处理特殊类型（如第三方系统的特定格式字符串）时才有必要。`PropertyEditor` 在现代项目中的存在感已降至最低，仅在维护遗留 XML 配置项目时可能会遇到。

## 数据绑定

```plain
原始输入（键值对 / 请求参数）
    │
    ▼
DataBinder 接收输入
    │
    |         ┌───  构造函数绑定（Constructor Binding）
    │         |         ├── 通过构造函数参数名匹配输入键
    │         |         ├── 递归构造嵌套对象
    │         |         └── 支持 List/Map/数组的索引键
    │─────────|        
    |         └───  属性绑定（Property Binding）
    |                   ├── BeanWrapper 解析属性路径（如 "address.city"）
    |                   ├── 调用 ConversionService 进行类型转换
    |                   └── 通过 setter 方法设置属性值
    │
    ▼
绑定结果写入 BindingResult
    │
    ▼
触发验证（如果标注了 @Valid / @Validated）

```

## 验证Validation(开发常用)

Java Bean Validation（JSR-380 / Jakarta Bean Validation）是一套通过**注解**声明验证规则的规范。Spring 通过 `LocalValidatorFactoryBean` 将其无缝集成到自身框架中，使得开发者可以在领域模型的属性上直接标注 `@NotNull`、`@Size`、`@Min` 等注解来声明验证规则，Spring 在数据绑定和请求处理过程中自动执行验证，并将结果反馈到 `BindingResult` 或抛出异常。

**Spring Boot 自动配置范围：**

* `LocalValidatorFactoryBean` 自动注册为 Spring Bean
* 同时适配为 `jakarta.validation.Validator` 和 `org.springframework.validation.Validator`
* `MethodValidationPostProcessor` 自动配置（需 classpath 中存在验证实现）
* Hibernate Validator（参考实现）通过 `spring-boot-starter-validation` 依赖自动引入
* `@DateTimeFormat`、`@NumberFormat` 等格式化注解的 `AnnotationFormatterFactory` 自动注册
* `FormattingConversionService` 自动配置，同时管理 `Converter` 和 `Formatter`

### 内置约束注解

| 注解 | 作用 | 适用类型 |
| --- | --- | --- |
| `@NotNull` | 值不能为 null | 任意类型 |
| `@NotEmpty` | 值不能为 null 且不能为空 | String、Collection、Map、数组 |
| `@NotBlank` | 值不能为 null 且去除空格后不能为空 | String |
| `@Size(min, max)` | 长度或大小必须在指定范围内 | String、Collection、Map、数组 |
| `@Min(value)` | 数值必须 ≥ 指定值 | 数值类型 |
| `@Max(value)` | 数值必须 ≤ 指定值 | 数值类型 |
| `@Email` | 字符串必须符合电子邮件格式 | String |
| `@Pattern(regexp)` | 字符串必须匹配正则表达式 | String |
| `@Past` / `@Future` | 日期必须为过去/未来的时间 | 日期类型 |
| `@Positive` / `@Negative` | 数值必须为正数/负数 | 数值类型 |
| `@AssertTrue` / `@AssertFalse` | 值必须为 true/false | Boolean |
| `@Valid` | 触发级联验证，验证嵌套对象中的约束 | 任意引用类型（嵌套对象、集合元素） |

### 验证失败抛出异常

**单独验证参数：**

在 `@ModelAttribute`、`@RequestBody`、`@RequestPart` 参数上标注 `@Valid` 或 `@Validated`，Spring 会单独验证这个参数对象。如果校验失败，抛出 `MethodArgumentNotValidException`。

```java
@PostMapping("/user")
public ResponseEntity<User> createUser(@Valid @RequestBody User user) {
    // User 对象里的 @NotBlank、@Email 等注解会被自动校验
    return ResponseEntity.ok(userService.save(user));
}
```

**方法级别验证：**

如果直接在方法参数上标注 `@Constraint` 注解（如 `@Min`、`@NotBlank`），而不是在参数对象的字段上，就会触发方法级别验证，抛出 `HandlerMethodValidationException`。

```java
@GetMapping("/user/{id}")
public User getUser(@PathVariable @Min(1) Long id) {
    // id 必须 >= 1
}
```

### @Valid 与 @Validated 的触发机制

`@Valid` 和 `@Validated` 本身不执行验证逻辑，它们的核心作用是**标记**——通知 Spring 框架在方法调用前拦截目标参数，调用验证器执行验证。

**Controller 层使用（最常用）：**

```java
@RestController
// controller上可以省略@Validated
public class UserController {

    @PostMapping("/users")
    public ResponseEntity<User> createUser(
            @Valid @RequestBody UserCreateRequest request) {
        // 验证失败时 Spring 自动抛出 MethodArgumentNotValidException
        return ResponseEntity.ok(userService.create(request));
    }
}
```

**Service 层方法参数验证：**

```java
@Validated//service层仍需加该注解，不能省略
@Service
public class UserService {
    public void addStudent(@Valid Person person, @Max(2) int degrees) {
        // 方法参数在调用前自动验证
    }
}
```

> 如果在 Controller 类上加了 `@Validated` 注解，方法验证会通过 AOP 代理实现。
>
> 从 Spring 6.1 起，Spring MVC 内置了方法验证支持，你不需要再加类级别的 `@Validated` 了，应该移除它，让 Spring 用内置的机制来处理。

### 自定义约束

当内置注解无法满足需求时，创建自定义约束需要两部分：

**第一步：声明注解**

```java
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PhoneValidator.class)
public @interface Phone {
    String message() default "手机号格式不正确";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

**第二步：实现验证逻辑**

```java
public class PhoneValidator implements ConstraintValidator<Phone, String> {
    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) return true;
        return value.matches("^1[3-9]\\d{9}$");
    }
}
```

Spring 的 `LocalValidatorFactoryBean` 默认配置了 `SpringConstraintValidatorFactory`，因此 `ConstraintValidator` 实现类可以通过 `@Autowired` 注入依赖，与其他 Spring Bean 无异。

***

### @DateTimeFormat失效误解

**为什么 @Valid 能触发验证但 @DateTimeFormat 不触发**

`@Valid` 标注在 `@RequestBody` 参数上时，Spring 的执行流程是：

1. Jackson 反序列化 JSON → 生成 Java 对象（`@JsonFormat` 控制日期格式）
2. 反序列化完成后，Spring 检查参数上的 `@Valid` 注解
3. Spring 调用 `LocalValidatorFactoryBean` 执行 Bean Validation
4. 约束注解（`@NotNull`、`@Past` 等）被检测并执行

> **`@Valid` 触发的验证发生在第 2、3 步，此时对象已经由 Jackson 在第一步创建完成。**`@DateTimeFormat` 本应在第一步之前就被 `DataBinder` 使用，但 `@RequestBody` 路径根本不经过 `DataBinder`，因此 `@DateTimeFormat` 永远不会被触发。

***

**例子：**

```java
@Data
public class UserCreateRequest {
    @DateTimeFormat(pattern = "yyyy-MM-dd")   // Spring 注解，在此处不生效
    @JsonFormat(pattern = "yyyy/MM/dd")       // Jackson 注解，控制 JSON 格式
    @NotNull(message = "生日不能为空")         // Bean Validation 注解，生效
    @Past(message = "生日必须是过去的时间")    // Bean Validation 注解，生效
    private LocalDate birthday;
}
```

当此 DTO 通过 `@Valid @RequestBody` 接收时，各注解的实际作用：

| 注解 | 是否生效 | 原因 |
| --- | --- | --- |
| `@JsonFormat(pattern = "yyyy/MM/dd")` | 生效 | Jackson 反序列化时读取此注解，将 JSON 中的 `"2024/03/15"`解析为 `LocalDate` |
| `@DateTimeFormat(pattern = "yyyy-MM-dd")` | **不生效** | `@RequestBody`路径不经 `DataBinder`，Spring 不读取此注解 |
| `@NotNull` | 生效 | `@Valid`触发 Bean Validation，在反序列化后执行 |
| `@Past` | 生效 | `@Valid`触发 Bean Validation，在反序列化后执行 |

***

**对比**

`@DateTimeFormat` 和 Jackson 的日期格式化分别隶属于 Spring 和 Jackson 两套独立的处理体系，对应两条互不交叉的请求处理路径：

| 维度 | @DateTimeFormat | Jackson 日期格式化 |
| --- | --- | --- |
| 所属框架 | Spring Framework | Jackson |
| 关联注解 | `@DateTimeFormat` | `@JsonFormat` |
| 全局配置 | `spring.mvc.format.date` | `spring.jackson.date-format` |
| 生效路径 | `@ModelAttribute`、`@RequestParam` | `@RequestBody` |
| 处理引擎 | `FormattingConversionService` | `ObjectMapper` |
| 与 `@Valid`的关系 | 无关 | 无关（`@Valid`在反序列化后触发） |

**在 `@RequestBody` 场景下，`@DateTimeFormat` 不生效，只能通过 `@JsonFormat` 控制日期格式。** 在 `@ModelAttribute` / `@RequestParam` 场景下，只能通过 `@DateTimeFormat` 控制日期格式，`@JsonFormat` 不生效。两者各自负责自己的处理路径，互不干扰，也互不替代。


> 更新: 2026-09-09 16:34:34  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/zmnzi9/xilbf4imnw492v6r>