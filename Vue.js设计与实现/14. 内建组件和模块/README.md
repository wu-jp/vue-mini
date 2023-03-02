# 内建组件和模块

## KeepAlive 组件的实现和原理

KeepAlive 一词借鉴于 HTTP 协议。在 HTTP 协议中，KeepAlive 又称HTTP 持久连接（HTTP persistent connection），其作用是允许多个请求或响应共用一个 TCP 连接。在没有 KeepAlive 的情况下，一个 HTTP 连接会在每次请求/响应结束后关闭，当下一次请求发生时，会建立一个新的 HTTP 连接。频繁地销毁、创建 HTTP 连接会带来额外的性能开销，KeepAlive 就是为了解决这个问题而生的。

```html
<template>
  <!-- 使用 KeepAlive 组件包裹 -->
  <KeepAlive>
    <Tab v-if="currentTab === 1">...</Tab>
    <Tab v-if="currentTab === 2">...</Tab>
    <Tab v-if="currentTab === 3">...</Tab>
  </KeepAlive>
</template>
```

将被 KeepAlive 的组件从原容器搬运到另外一个隐藏的容器中，实现“假卸载”。当被搬运到隐藏容器中的组件需要再次被“挂载”时，我们也不能执行真正的挂载逻辑，而应该把该组件从隐藏容器中再搬运到原容器。这个过程对应到组件的生命周期，其实就是 activated 和deactivated。

实现一个最基本的 KeepAlive 组件：
