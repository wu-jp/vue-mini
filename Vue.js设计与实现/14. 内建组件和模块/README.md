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

```js
const KeepAlive = {
  // KeepAlive 组件独有的属性，用作标识
  _isKeepAlive: true,
  setup(props, { slots }) {
    const cache = new Map()

    const instance = currentInstance

    const { move, createElement } = instance.KeepAliveCtx

    const storageContainer = createElement('div')

    instance._deActivate = (vnode) => {
      move(vnode, storageContainer)
    }

    instance._activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
    }

    return () => {
      let rawVNode = slots.default()

      if (typeof rawVNode.type !== 'object') {
        return rawVNode
      }

      // 获取组件内部的name
      const name = rawVNode.type.name
      // 如果 name 无法被 include 匹配或者被 exclude 匹配
      if (name && (
        (props.include && !props.include.test(name)) || (props.exclude && props.exclude.test(name))
      )) {
        // 则直接渲染内部组件，不对其进行后续的缓存操作
        return rawVNode
      }

      const cachedVNode = cache.get(rawVNode.type)
      if (cachedVNode) {
        rawVNode.component = cachedVNode.component
        rawVNode.KeptAlive = true
      } else {
        cache.set(rawVNode.type, rawVNode)
      }

      rawVNode.shouldKeepAlive = true

      rawVNode.KeepAliveInstance = instance

      return rawVNode
    }
  }
}
```

在卸载的时候，需要先检查组件是否被 keepalive，而执行不同的操作：

```js
function unmount(vnode) {
  // 再卸载时，类型为 Fragment 的节点，需要依次卸载
  if (vnode.type === Fragment) {
    vnode.children.forEach(c => unmount(c))
    return
  } else if (typeof vnode.type === 'object') {

    // 对需要被 keepalive 的组件，不进行真的卸载，而是应用该组件的父组件，即 KeepAlive 组件的 _deActivate 函数使其失活
    if (vnode.shouldKeepAlive) {
      vnode.keepAliveInstance._deActivate(vnode)
    } else {
      // 对于组件的卸载，本质上是要卸载组件所渲染的内容，即 subTree 子树
      unmount(vnode.component.subTree)
    }
  }

  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode.el)
  }
}
```

在渲染的时候 需要判断该组件是否被缓存，被缓存的组件会被添加一个 keptAlive 标记，如果存在则直接激活：

```js
function patch(n1, n2, container, anchor) {
    // 如果n1 存在，则对比 n1 和 n2 的类型
    if (n1 && n1.type !== n2.type) {
      // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
      unmount(n1)
      n1 = null
    }

    // 运行到这里说明，n1和n2的类型相同
    const { type } = n2

    if (typeof type === 'string') {
      // 忽略其他问题
    } else if (typeof type === 'object' || typeof type === 'function') {
      // type 是对象 -->  有状态组件
      // type 是函数 -->  函数式组件

      // 如果n2的类型时一个对象，则它描述的是组件
      if (!n1) {

        // 如果该组件已经被 keepalive，则不会重新挂载它，而是会调用 _activeate 来激活它
        if (n2.KeptAlive) {
          n2.keepAliveInstance._activate(n2, container, anchor)
        } else {
          // 挂载组件
          mountComponent(n2, container, anchor, patch, createElement)
        }
      } else {
        // 更新组件
        patchComponent(n1, n2, anchor)
      }
    } else if (type === Text) {
      // 忽略其他问题
    } else if (type === Fragment) {
      // 忽略其他问题
    }
  }
```

失活的本质就是将组件所渲染的内容移动到隐藏容器中，而激活的本质是将组件所渲染的内容从隐藏容器中搬运回原来的容器。

```js
export function mountComponent(vnode, container, anchor, patch, createElement) {

  // 省略其他代码

  // 定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态选项
  const instance = {
    // 组件自身的状态数据，即data
    state,
    // 解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
    props: shallowReactive(props),
    // 一个布尔值，用来表示组件是否已经别挂载，初始值为false
    isMounted: false,
    // 组件所渲染的内容，即子树（subTree）
    subTree: null,
    // 将插槽添加到组件实例上
    slots,
    // 在组件实例中添加 mounted 数组，用来存储通过onMounted 函数注册的生命周期钩子函数
    mounted: [],
    // 只有 keepalive 组件的实例下会有 keepaliveCtx 属性
    KeepAliveCtx: null
  }

  // 检查当前要挂载的组件是否是 keepalive 组件
  const isKeepAlive = vnode.type.__isKeepAlive

  if (isKeepAlive) {
    // 在keepalive 组件实例上添加 keepaliveCtx 对象
    instance.KeepAliveCtx = {
      // move 函数用来移动一段 vnode
      move(vnode, container, anchor) {
        // 本质上是将租价渲染的内容转移到指定容器中，即隐藏容器中
        insert(vnode.component.subTree.el, container, anchor)
      },
      createElement
    }
  }
  // 省略其他代码
}
```

这样就完成了一个 keepalive 组件。
