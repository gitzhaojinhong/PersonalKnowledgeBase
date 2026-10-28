## AOT优化机制

Spring 的 Ahead of Time（AOT）优化机制，其核心思想是在**构建时**（build time）对 `ApplicationContext` 进行静态分析，将传统上只能在运行时执行的 Bean 发现、条件评估、依赖推理等逻辑提前完成，并据此生成可直接用于启动的 Java 源代码、字节码和运行时提示（RuntimeHints）。这一机制的首要目标是支持 Spring 应用以 GraalVM 原生镜像（Native Image）的形式部署，在此场景下，传统的类路径扫描和反射调用在运行时不可用，因此必须在构建时就完成所有必要的分析和配置固化。

[Ahead of Time Optimizations文档跳转](https://docs.spring.io/spring-framework/reference/6.2/core/aot.html)

**启用AOT：**

**Maven**：添加 `spring-boot-maven-plugin` 并执行 `native:compile` 目标，或直接使用 `mvn -Pnative native:compile`（Spring Boot 已预置 native profile）。
