# 渲染器的设计

## 渲染器和响应系统的结合

渲染器是用来实现渲染任务的。渲染真实DOM到页面。

```html
<!-- @vue/reactivity 提供了IIFE 模块格式，因此我们可以直接通过 <script> 标签引用到页面中使用 -->
<script src="https://unpkg.com/@vue/reactivity@3.0.5/dist/reactivity.global.js"></script>
<script type="module" src="./index.js"></script>
```

```js
// index.js 文件

// 我们通过 VueReactivity 得到了 effect 和 ref 这两个 API。
const { effect, ref } = VueReactivity

function renderer(domString, container) {
  container.innerHTML = domString
}

const count = ref(1)

effect(() => {
  renderer(`<h1>${count.value}</h1>`, document.getElementById('app'))
})

setTimeout(() => {
  count.value++
}, 1500)

```

## 渲染器的基本该概念

我们通常使用英文 **renderer 来表达“渲染器”**。千万不要把 renderer 和render 弄混了，前者代表渲染器，而后者是动词，表示“渲染”。渲染器的作用是把虚拟 DOM 渲染为特定平台上的真实元素。在浏览器平台上，渲染器会把虚拟 DOM 渲染为真实 DOM 元素。

虚拟 DOM 通常用英文 virtual DOM 来表达，有时会简写成 vdom。虚拟节点 virtual node，有时候会简写成 vnode。虚拟 DOM 是树型结构，这棵树中的任何一个 vnode 节点都可以是一棵子树，因此 vnode 和 vdom 有时可以替换使用。

**渲染器把虚拟 DOM 节点渲染为真实 DOM 节点的过程叫作挂载**，通常用英文 `mount` 来表达。

那么，渲染器把真实 DOM 挂载到哪里呢？*其实渲染器并不知道应该把真实 DOM 挂载到哪里*。因此，**渲染器通常需要接收一个挂载点作为参数，用来指定具体的挂载位置**。这里的“挂载点”其实就是一个 DOM 元素，渲染器会把该DOM 元素作为容器元素，并把内容渲染到其中。我们通常用英文 `container` 来表达容器。

```js
// 创建渲染器函数
function createRenderer() {
  function render(vnode, container) {
    if (vnode) {
      // 如果vnode存在，将它和 旧的vnode 一起传给 patch 函数时，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新的不存在，说明是卸载操作（unmount）
        // 只需要将 container 内的 DOM 清除即可
        container.innerHTML = ''
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  /**
   * patch函数是整个渲染器的核心入口，它承载了最重要的渲染逻辑。
   * @param {*} n1 旧 vnode
   * @param {*} n2 新 vnode
   * @param {*} container 容器
   */
  function patch(n1, n2, container) {
    /* ... */
  }

  return render
}
```

## 自定义渲染器

渲染器不仅能够把虚拟 DOM 渲染为浏览器平台上的真实 DOM。通过将渲染器设计为可配置的“通用”渲染器，即可实现渲染到任意目标平台上。

我们以浏览器作为渲染的目标平台，编写一个渲染器，在这个过程中，看看哪些内容是可以抽象的，然后通过抽象，将浏览器特定的API 抽离，这样就可以使得渲染器的核心不依赖于浏览器。在此基础上，我们再为那些被抽离的 API 提供可配置的接口，即可实现渲染器的跨平台能力。

```js
const { effect, ref } = VueReactivity

// 创建渲染器函数
function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText
  } = options

  function render(vnode, container) {
    if (vnode) {
      // 如果vnode存在，将它和 旧的vnode 一起传给 patch 函数时，进行打补丁
      patch(container._vnode, vnode, container)
    } else {
      if (container._vnode) {
        // 旧 vnode 存在，且新的不存在，说明是卸载操作（unmount）
        // 只需要将 container 内的 DOM 清除即可
        container.innerHTML = ''
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }

  /**
   * patch函数是整个渲染器的核心入口，它承载了最重要的渲染逻辑。
   * @param {*} n1 旧 vnode
   * @param {*} n2 新 vnode
   * @param {*} container 容器
   */
  function patch(n1, n2, container) {
    if (!n1) {
      // n1不存在，意味着挂载，则调用 mountElement 函数完成挂载
      mountElement(n2, container)
    } else {
      // n1存在，意味着补丁，暂时忽略
    }
  }

  /**
   * 挂载函数
   * @param {*} vnode 挂载的虚拟dom
   * @param {*} container 容器
   */
  function mountElement(vnode, container) {
    // 创建DOM元素
    const el = createElement(vnode.type)

    // 处理子节点，如果子节点是字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      // 设置元素的 textContent 属性即可
      setElementText(el, vnode.children)
    }

    // 将元素添加到容器中
    insert(el, container)
  }

  return render
}

const vnode = {
  type: 'h1',
  children: 'hello'
}

// 在创建 renderer时传入配置项 （操作 DOM 的配置）
// 只要传入不同的配置项，就能够完成非浏览器环境下的渲染工作。
const render = createRenderer({
  // 用于创建元素
  createElement(tag) {
    return document.createElement(tag)
  },
  // 用于设置元素的文本节点
  setElementText(el, text) {
    el.textContent = text
  },
  // 用于在给定的 parent 下添加指定元素
  insert(el, parent, anchor = null) {
    parent.insertBefore(el, anchor)
  }
})

render(vnode, document.querySelector('#app'))
```

将自定义环境所需的配置，传入createRendere函数，就可以实现自定义渲染器了。
