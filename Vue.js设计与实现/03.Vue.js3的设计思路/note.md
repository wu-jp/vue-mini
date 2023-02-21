# Vue.js 3 的设计思路

## 声明式的描述UI

前端页面涉及到那些内容？

- DOM元素
- 属性
- 事件
- 元素的层级结构

如果声明式描述上面的内容呢？

- 使用和html标签一致的方式来描述dom元素，例如描述一个 div 标签时可以使用 `<div></div>`
- 使用和html标签一致的方式来描述属性，例如 `<div id="app"></div>`
- 使用 : 或 v-bind 来描述动态绑定的属性，例如 `<div :id="dynamicId"></div>`
- 使用 @ 或 v-on 来描述事件，例如点击事件 `<div @click="handler"></div>`
- 使用与 HTML 标签一致的方式来描述层级结构，例如一个具有 span 子节点的 div 标签 `<div><span></span></div>`


除了使用模板来声明描述UI之外，还可以使用JavaScript对象来描述：
```js
const title = {
  // 标签名称
  tag: 'h1',
  // 标签属性
  props: {
    onClick: handler
  },
  // 子节点
  children: [
    { tag: 'span' }
  ]
}
```
对于的vue.js 模板就是：
```html
<h1 @click="handler"><span></span></h1>
```

这样看来，显然式js对象描述更加灵活。通过JS来描述UI的方式，其实就是所谓的虚拟DOM。

渲染函数：一个组件要渲染的内容是通过渲染函数来描述的，也就是下面代码中的render函数，Vue.js 会根据组件的render函数的返回值拿到虚拟DOM，然后就可以把组件的内容渲染出来了。
```js
export default {
  render() {
    return {
      tag: 'h1',
      props: { onClick: handler }
    }
  }
}
```

## 初识渲染器

我们已经知道，其实虚拟DOM就是用JavaScript对象俩描述真实DOM的结构。那么怎么将虚拟DOM渲染到浏览器页面中呢？这里就用到了：渲染器。

假设有如下的虚拟DOM:
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click me'
}
```
首先简单解释一下上面这段代码。
- tag 用来描述标签名称，所以 tag: 'div' 描述的就是一个 `<div>` 标签。
- props 是一个对象，用来描述 `<div>` 标签的属性、事件等内容。可以看到，我们希望给 div 绑定一个点击事件。
- children 用来描述标签的子节点。在上面的代码中，children 是一个字符串值，意思是 div 标签有一个文本子节点：`<div>click me</div>`

接下来需要编写一个渲染器，把虚拟DOM渲染为真实DOM:
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click me'
}

/**
 *
 * @param {*} vnode 虚拟DOM对象
 * @param {*} container 一个真实的DOM，作为挂载点，渲染器会把虚拟DOM挂载到该元素下。
 */
function renderer(vnode, container) {
  // 使用 vnode.tag 作为标签名创建DOM元素
  const el = document.createElement(vnode.tag)
  // 遍历 vnode.props，将属性、事件添加到 DOM 元素
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      // 如果 key 以 on 开头，说明它是事件
      el.addEventListener(
        key.substr(2).toLocaleLowerCase(),// 事件名称 onClick ---> click
        vnode.props[key] // 事件处理函数
      )
    }
  }

  // 处理children
  if (typeof vnode.children === 'string') {
    // 如果 children 是字符串，说明它是元素的文本子节点
    el.appendChild(document.createTextNode(vnode.children))
  } else if (Array.isArray(vnode.children)) {
    // 递归地调用 renderer 函数渲染子节点，使用当前元素 el 作为挂载点
    vnode.children.forEach(child => renderer(child, el))
  }

  // 将元素添加到挂载点下
  container.appendChild(el)
}

// body 作为挂载点
renderer(vnode, document.body)
```

总结分为三步：
- 创建元素：把 vnode.tag 作为标签名称来创建 DOM 元素。
- 为元素添加属性和事件：遍历 vnode.props 对象，如果key 以 on 字符开头，说明它是一个事件，把字符 on 截取掉后再调用 toLowerCase 函数将事件名称小写化，最终得到合法的事件名称，例如 onClick 会变成 click，最后调用addEventListener 绑定事件处理函数。
- 处理 children：如果 children 是一个数组，就递归地调用renderer 继续渲染，注意，此时我们要把刚刚创建的元素作为挂载点（父节点）；如果 children 是字符串，则使用createTextNode 函数创建一个文本节点，并将其添加到新创建的元素内。

以上仅仅只是做了创建节点，渲染器的精髓都在更新节点的阶段。

我们对vnode做一点小的修改：
```js
const vnode = {
  tag: 'div',
  props: {
    onClick: () => alert('hello')
  },
  children: 'click again' // 从 me 改成 again
}
```

对于渲染器来说，它需要精确地找到 vnode 对象的变更点并且只更新变更的内容。就上例来说，渲染器应该只更新元素的文本内容，而不需要再走一遍完整的创建元素的流程。这些内容后文会重点讲解，但无论如何，希望大家明白，渲染器的工作原理其实很简单，归根结底，都是使用一些我们熟悉的DOM 操作 API 来完成渲染工作。

## 组件的本质

组件是什么？组件和虚拟DOM有什么关系？渲染器如何渲染组件？

| 组件是一组 DOM 元素的封装，这组 DOM 元素就是组件需要渲染的内容。

因此我们可以定义一个函数来表达一个组件，而函数的返回值就是代表组件需要渲染的内容：

```js
const MyComponent = function (){
  return {
    tag: 'div',
    props: {
      onClick: () => alert('hello')
    },
    children: 'click me'
  }
}
```
可以看到，组件的返回值也是一个虚拟 DOM，他代表组件需要渲染的内容。

搞清楚了组件，那我们就可以让虚拟DOM对象的tag属性来存储组件函数了。
```js
const vnode = {
  tag: MyComponent
}
```
用 `tag: MyComponent` 来描述组件，只不过这里的tag属性不是标签名称，而是组件函数。为了可以渲染组件，需要修改渲染器函数。
```js
function renderer(vnode, container) {
  if(typeof vnode.tag === 'string') {
    // 说明vnode描述的是一个标签元素
    mountElement(vnode, container)
  }else if(typeof vnode.tag === 'function') {
    // 说明 vnode 描述的是一个组件
    mountComponent(vnode, container)
  }
}
```

如果`vnode.tag`是一个字符串，说明它描述的是一个普通的标签元素，调用mountElement函数完成渲染；如果`vnode.tag`是一个函数，说明描述的是一个组件，需要调用mountComponent函数完成渲染。其中mountElement函数和上文中的renderer函数内容是一致的：
```js
function mountElement(vnode, container) {
  // 使用 vnode.tag 作为标签名创建DOM元素
  const el = document.createElement(vnode.tag)
  // 遍历 vnode.props，将属性、事件添加到 DOM 元素
  for (const key in vnode.props) {
    if (/^on/.test(key)) {
      // 如果 key 以 on 开头，说明它是事件
      el.addEventListener(
        key.substr(2).toLocaleLowerCase(),// 事件名称 onClick ---> click
        vnode.props[key] // 事件处理函数
      )
    }
  }

  // 处理children
  if (typeof vnode.children === 'string') {
    // 如果 children 是字符串，说明它是元素的文本子节点
    el.appendChild(document.createTextNode(vnode.children))
  } else if (Array.isArray(vnode.children)) {
    // 递归地调用 renderer 函数渲染子节点，使用当前元素 el 作为挂载点
    vnode.children.forEach(child => renderer(child, el))
  }

  // 将元素添加到挂载点下
  container.appendChild(el)
}
```

再实现 mountComponent 函数：
```js
function mountComponent(vnode, container) {
  // 调用组件函数，获取组件函数需要渲染的内容（虚拟 DOM ）
  const subtree = vnode.tag()
  // 递归调用 renderer 渲染 subtree
  renderer(subtree, container)
}
```

可以看到，非常简单。首先调用 vnode.tag 函数，我们知道它其实就是组件函数本身，其返回值是虚拟 DOM，即组件要渲染的内容，这里我们称之为 subtree。既然 subtree 也是虚拟 DOM，那么直接调用 renderer 函数完成渲染即可

问题：组件一定是一个函数嘛？
当然不是，可以使用一个JavaScript对象来描述：
```js
// MyComponent 是一个对象
const MyComponent = {
  render() {
    return {
      tag: 'div',
      props: {
        onClick: () => alert('hello')
      },
      children: 'click me'
    }
  }
}
```
这里我们使用一个对象来代表组件，该对象有一个函数，叫作render，其返回值代表组件要渲染的内容。为了完成组件的渲染，我们需要修改 renderer 渲染器以及 mountComponent 函数。

先修改渲染器的判断：
```js
function renderer(vnode, container) {
  if (typeof vnode.tag === 'string') {
    // 说明vnode描述的是一个标签元素
    mountElement(vnode, container)
  } else if (typeof vnode.tag === 'function') {
    // 说明 vnode 描述的是一个组件
    mountComponent(vnode, container)
  } else if (typeof vnode.tag === 'object') {
    // 说明 vnode 描述的是一个组件
    mountComponent(vnode, container)
  }
}
```

再修改 mountComponent 函数：
```js
function mountComponent(vnode, container) {
  let subtree;
  if (typeof vnode.tag === 'function') {
    // 调用组件函数，获取组件函数需要渲染的内容（虚拟 DOM ）
    subtree = vnode.tag()
  } else if (typeof vnode.tag === 'object') {
    // tag是组件对象，调用它的 render 函数，获取组件需要渲染的内容（虚拟 DOM ）
    subtree = vnode.tag.render()
  }

  // 递归调用 renderer 渲染 subtree
  renderer(subtree, container)
}
```

可以发现，我们只做了很小的修改，就能够满足用对象来表达组件的需求。那么大家可以继续发挥想象力，看看能否创造出其他的组件表达方式。其实 Vue.js 中的有状态组件就是使用对象结构来表达的。

## 模板的工作原理

无论手写虚拟DOM（渲染函数）还是使用模板，都属于声明式的描述UI，Vue.js也同时支持这两种方式。

上面说了虚拟DOM如何渲染成真实DOM。那么模板是如何变成渲染函数的呢？这里就需要另一个重要的模块：编译器。

编译器的作用其实就是将模板编译为渲染函数。

例如有如下模板：
```html
<div @click="handler">
  click me
</div>
```
对于编译器来说，模板就是一个普通的字符串，它会分析并生成一个功能和之前一样的渲染函数：
```js
render () {
  return h('div', { onClick: handler }, 'click me')
}
```

我们再以一个vue组件为例子：
```js
<template>
  <div @click="handler">
    click me
  </div>
</template>

<script>
  export default {
    data() {},
    methods: {
      handler(){}
    }
  }
</script>
```
其中 `<template>` 标签里的内容就是模板内容，编译器会把模板内容编译成渲染函数并添加到 `<script>` 标签块的组件对象上，所以最终在浏览器里运行的代码就是：
```js
export default {
  data(){}，
  methods: {
    handler(){}
  },
  render(){
    return h('div', { onClick: handler }, 'click me')
  }
}
```
所以，无论是使用模板还是直接手写渲染函数，对于一个组件来说，它要渲染的内容最终都是通过渲染函数产生的，然后渲染器再把渲染函数返回的虚拟 DOM 渲染为真实 DOM，这就是模板的工作原理，也是 Vue.js 渲染页面的流程。

## Vue.js 是各个模块组成的有机整体

组件的实现依赖于渲染器，模板的编译依赖于编译器，并且编译后生成的代码是根据渲染器和虚拟 DOM 的设计决定的，因此 Vue.js 的各个模块之间是互相关联、互相制约的，共同构成一个有机整体。

这里我们以编译器和渲染器这两个非常关键的模块为例，看看它们是如何配合工作，并实现性能提升的。

假设我们有如下模板：
```html
<div id="foo" :class="cls"></div>
```

根据上文的介绍，我们知道编译器会把这段代码编译成渲染函数：

```js
render() {
  // 下面的代码等价于：
  // return h('div', {id: 'foo', class: cls})
  return {
    tag: 'div',
    props: {
      id: 'foo',
      class: cls
    }
  }
}
```

cls是一个变量，可能会发生变化。我们知道渲染器的作用之一就是寻找并且只更新变化的内容，所以当变量 cls 的值发生变化时，渲染器会自行寻找变更点。对于渲染器来说，这个“寻找”的过程需要花费一些力气。那么从编译器的视角来看，它能否知道哪些内容会发生变化呢？

如果编译器有能力分析动态内容，并在编译阶段把这些信息提取出来，然后直接交给渲染器，这样渲染器不就不需要花费大力气去寻找变更点了吗？这是个好想法并且能够实现。

如果编译器有能力分析动态内容，并在编译阶段把这些信息提取出来，然后直接交给渲染器，这样渲染器不就不需要花费大力气去寻找变更点了吗？这是个好想法并且能够实现。

```js
render() {
  return {
    tag: 'div',
    props: {
      id: 'foo',
      class: cls
    },
    patchFlags: 1 // 假设数字 1 表示 class 是动态的
  }
}
```

如上面的代码所示，在生成的虚拟 DOM 对象中多出了一个patchFlags 属性，我们假设数字 1 代表“ class 是动态的”，这样渲染器看到这个标志时就知道：“哦，原来只有 class 属性会发生改变。”对于渲染器来说，就相当于省去了寻找变更点的工作量，性能自然就提升了。
