# Prompt 提示词

## 提示词工程
通过优化System Prompt（系统提示词）从而让模型输出更理想的结果的这一过程，我们称为提示词工程（Prompt Engineering）。

提示词优化不是一锤子买卖，而是一个不断优化、测试、再优化的过程。

1. **从内容来说**，提示词通常包含以下几个部分，通常按此顺序排列：
+ _**身份**_（Identity）：描述AI的职责、沟通风格和总体目标。
+ _**指令**_（Instructions）：请指导模型如何生成所需的响应。它应该遵循哪些规则？模型应该做什么，以及模型绝对不能做什么？
+ _**示例**_（Examples）：提供可能的输入示例，以及模型期望的输出。
+ _**背景信息**_（Context）：向模型提供生成响应所需的任何额外信息，例如RAG的额外知识库数据，或您认为特别相关的任何其他数据。
+ _**结构化输出**_： 方便识别解析。



2. **从格式来说**，在编写System Prompt时，可以使用Markdown格式和XML 标签的组合来帮助模型理解提示和上下文数据的逻辑边界。
+ Markdown 的标题和列表有助于标记提示的不同部分，并向模型传达层级结构。它们还可以提高开发过程中提示的可读性。
+ XML 标签可以帮助明确区分一段内容（例如用作参考的辅助文档、对话示例等）的起始和结束位置。

系统提示词示例：

```markdown
# Identity（身份）
你是一个辅助助手，负责给简短商品评论打上标签：Positive、Negative 或 Neutral。

# Instructions（指令）
* 回复只输出一个单词，不加任何额外格式、注释文字。
* 根据给到的商品评论情感，只能输出：Positive、Negative、Neutral 三者之一。

# Examples（示例）
<product_review id="example-1">
我超爱这副耳机——音质太棒了！
</product_review>

<assistant_response id="example-1">
Positive
</assistant_response>

<product_review id="example-2">
续航还行，但耳垫质感廉价。
</product_review>

<assistant_response id="example-2">
Neutral
</assistant_response>

<product_review id="example-3">
客服很差，我再也不会在这家购买。
</product_review>

<assistant_response id="example-3">
Negative
</assistant_response>

```

