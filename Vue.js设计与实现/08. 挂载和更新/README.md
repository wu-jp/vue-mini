# 挂载和更新

## 1.挂载子节点和元素的属性

```js
const vnode = {
  type: 'div',
  props: {
    id: 'foo'
  },
  children: [
    {
      type: 'p',
      children: 'hello'
    }
  ]
}
```

如果children是数组，那么就循环遍历它， 注意两个点：

1. patch 的第一个参数是null,因为是挂载阶段。形成递归调用mountElement
2. patch 的第三个参数是就是 调用patch时创建的 DOM 元素。


```js
function mountElement(vnode, container) {
  // 创建DOM元素
  const el = createElement(vnode.type)

  // 处理子节点，如果子节点是字符串，代表元素具有文本节点
  if (typeof vnode.children === 'string') {
    // 设置元素的 textContent 属性即可
    setElementText(el, vnode.children)
  } else if (Array.isArray(vnode.children)) {
    // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载他们
    vnode.children.forEach(child => {
      patch(null, child, el)
    })
  }

  // 将元素添加到容器中
  insert(el, container)
}
```

vnode.props 是一个对象，它的键代表元素的属性名称，它的值代表对应属性的值。

有两种方法设置属性：

1. 调用setAttribute将属性设置到元素上
2. 直接设置属性，即 `el[key] = vnode.props[key]`


```js
function mountElement(vnode, container) {
  // 创建DOM元素
  const el = createElement(vnode.type)

  // 处理子节点，如果子节点是字符串，代表元素具有文本节点
  if (typeof vnode.children === 'string') {
    // 设置元素的 textContent 属性即可
    setElementText(el, vnode.children)
  } else if (Array.isArray(vnode.children)) {
    // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载他们
    vnode.children.forEach(child => {
      patch(null, child, el)
    })
  }

  if (vnode.props) {
    for (const key in vnode.props) {
      // 方法1：调用setAttribute将属性设置到元素上
      // el.setAttribute(key, vnode.props[key])

      // 方法2：直接设置
      el[key] = vnode.props[key]
    }
  }

  // 将元素添加到容器中
  insert(el, container)
}
```


## 2. HTML Attribute 与 DOM Properties

理解 HTML Attributes 和 DOM Properties 之间的差异和关联非常重要，这能够帮助我们合理地设计虚拟节点的结构，更是正确地为元素设置属性的关键。

HTML Attributes 的作用是设置与之对应的 DOM Properties 的初始值。一旦值改变，那么 DOM Properties 始终存储着当前值，而通过 getAttribute 函数得到的仍然是初始值。

```html
<input value='foo' />
```

手动修改输入框的值为 'bar'

```js
el.getAttribute('value') // 仍然是 'foo'
el.value // 'bar'
el.defaultValue // 'foo'
```

一个 HTML Attributes 可能关联多个 DOM Properties。

HTML Attributes 与 DOM Properties 之间的关系很复杂，但其实我们只需要记住一个核心原则即可：HTML Attributes 的作用是设置与之对应的 DOM Properties 的初始值。

## 3. 正确的设置元素属性

优先设置元素的 DOM Properties，但当值为空字符串时，要手动将值矫正为true。只有这样，才能保证代码的行为符合预期

```js
const { effect, ref } = VueReactivity

// 创建渲染器函数
function createRenderer(options) {
  // 通过 options 得到操作 DOM 的 API
  const {
    createElement,
    insert,
    setElementText,
    patchProps
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
    } else if (Array.isArray(vnode.children)) {
      // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载他们
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }

    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }

    // 将元素添加到容器中
    insert(el, container)
  }
  return render
}

// 该函数会返回一个布尔值，代表属性是否应该作为 DOM Properties 被设置
function shouldSetAsProps(el, key, value) {
  // 特殊处理（这里以form属性为例，还有其他的就不一一写了）
  if (key === 'form' && el.tagName === 'INPUT') return false
  // 兜底， 用 in 操作符 判断 key 是否存在对应的 DOM Properties
  return key in el
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
  },
  // 用于将属性设置相关操作封装到该函数中，并作为参数传递
  patchProps(el, key, prevValue, nextValue) {
    // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
    if (shouldSetAsProps(el, key, nextValue)) {
      // 获取 DOM Properties 的类型
      const type = typeof el[key]

      // 如果是布尔类型，并且value 是空字符串，将矫正为true
      if (type === 'boolean' && value === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // 如果设置的值没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue)
    }
  }
})

const vnode = {
  type: 'div',
  props: {
    id: 'foo'
  },
  children: [
    {
      type: 'p',
      children: 'hello'
    }
  ]
}

render(vnode, document.querySelector('#app'))
```

使用 shouldSetAsProps 函数过滤到那些只读的属性，禁止设置

将和DOM 操作有关的函数，都封装 为配置文件，这样就可针对不同的环境，配置不同的操作方法。


## 4. class 的处理

在vue.js中设置class的方式有很多种：

方式1：
```html
<p class="foo bar"></p>
```

```js
const vnode = {
  type: 'p',
  props: {
    class: 'foo bar'
  }
}
```

方式2：
```html
<p :class="cls"></p>
```

```js
const cls = {foo: true, bar: false}

const vnode = {
  type: 'p',
  props: {
    class: {foo: true, bar: false}
  }
}
```

方式3：
```html
<p class="arr"></p>
```

```js
const arr = ['foo bar', {baz: true}]

const vnode = {
  type: 'p',
  props: {
    class: [
      'foo bar',
      {baz: true}
    ]
  }
}
```

因为 class 的值可以是多种类型，所以我们必须在设置元素的class 之前将值归一化为统一的字符串形式，再把该字符串作为元素的 class 值去设置。因此，我们需要封装 normalizeClass 函数，用它来将不同类型的class 值正常化为字符串，例如：

```js
const vnode = {
  type: 'p',
  props: {
    // 使用函数 normalizeClass 对值进行序列化
    class: normalizeClass([
      'foo bar',
      {baz: true}
    ])
  }
}
```

最后的结果等价于：

```js
const vnode = {
  type: 'p',
  props: {
    class: 'foo bar baz'
  }
}
```

在浏览器中为一个元素设置 class 有三种方式，即使用setAttribute、el.className 或 el.classList。那么哪一种方法的性能更好呢？测试得到 el.className 的性能最优。我们需要调整 patchProps 函数的实现，如下面的代码所示：

```js
const render = createRenderer({
  // 省略其他

  patchProps(el, key, prevValue, nextValue) {
    // 对class的特殊处理
    if (key === 'class') {
      el.className = nextValue || ''
    }
    // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
    else if (shouldSetAsProps(el, key, nextValue)) {
      // 获取 DOM Properties 的类型
      const type = typeof el[key]

      // 如果是布尔类型，并且value 是空字符串，将矫正为true
      if (type === 'boolean' && value === '') {
        el[key] = true
      } else {
        el[key] = nextValue
      }
    } else {
      // 如果设置的值没有对应的 DOM Properties，则使用 setAttribute 函数设置属性
      el.setAttribute(key, nextValue)
    }
  }
})
```

## 5. 卸载操作

我们需要在 vnode 与真实 DOM 元素之间建立联系，修改 mountElement 函数：
```js
function mountElement(vnode, container) {
    // 让 vnode.el 引用真实 DOM 元素
    const el = vnode.el = createElement(vnode.type)

    if (typeof vnode.children === 'string') {
      setElementText(el, vnode.children)
    } else if (Array.isArray(vnode.children)) {
      vnode.children.forEach(child => {
        patch(null, child, el)
      })
    }
    if (vnode.props) {
      for (const key in vnode.props) {
        patchProps(el, key, null, vnode.props[key])
      }
    }
    insert(el, container)
  }
```

当旧vnode存在，新vnode不存在时，代表卸载：
```js
function render(vnode, container) {
  if (vnode) {
    // 如果vnode存在，将它和 旧的vnode 一起传给 patch 函数时，进行打补丁
    patch(container._vnode, vnode, container)
  } else {
    if (container._vnode) {
      // 旧 vnode 存在，且新的不存在，说明是卸载操作（unmount）
      // 只需要将 container 内的 DOM 清除即可
      unmount(container._vnode)
    }
  }
  // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
  container._vnode = vnode
}
```

封装 unmount 卸载方法：
```js
/**
 * 卸载函数
 * @param {*} vnode 卸载的虚拟节点
 */
function unmount(vnode) {
  const parent = vnode.el.parentNode
  if (parent) {
    parent.removeChild(vnode)
  }
}
```
封装 unmount 方法有两个好处：

1. 在 unmount 函数内，我们有机会调用绑定在 DOM 元素上的指令钩子函数，例如 beforeUnmount、unmounted 等。
2. 当 unmount 函数执行时，我们有机会检测虚拟节点 vnode 的类型。如果该虚拟节点描述的是组件，则我们有机会调用组件相关的生命周期函数。

## 6. 区分 vnode 类型

当 render 函数传递了新的vnode，则不会进行卸载，而是把新旧vnode都传递给patch函数进行打补丁操作。但在具体打补丁之前，我们需要确保新旧vnode所描述的内容是否相同。

如果不相同，先将旧的vnode卸载，再重新挂载新vnode；如果相同，再进行打补丁。

```js
function patch(n1, n2, container) {
  // 如果n1 存在，则对比 n1 和 n2 的类型
  if (n1 && n1.type !== n2.type) {
    // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
    unmount(n1)
    n1 = null
  }

  // 运行到这里说明，n1和n2的类型相同
  const { type } = n2

  if (typeof type === 'string') {
    if (!n1) {
      // n1不存在，意味着挂载，则调用 mountElement 函数完成挂载
      mountElement(n2, container)
    } else {
      // n1存在，意味着补丁
      patchElement(n1, n2)
    }
  } else if (typeof type === 'object') {
    // 如果n2的类型时一个对象，则它描述的是组件
  } else if (type === 'xxx') {
    // 处理其他类型的 vnode
  }
}
```

这里需要注意的是，卸载完成后，我们应该将参数 n1 的值重置为 null，这样才能保证后续挂载操作正确执行。

## 7. 事件的处理

事件可以视作一种特殊的属性，因此我们可以约定，在 vnode.props 对象中，凡是以字符串 on 开头的属性都视作事件。例如：

```js
const vnode = {
  type: 'p',
  props: {
    onClick: () => {
      alert('hello click')
    }
  },
  children: 'text'
}
```

只需要在 patchProps 中调用 addEventListener 函数来绑定事件即可，如下面的代码所示：

```js
patchProps(el, key, prevValue, nextValue) {
  if (/^on/.test(key)) {
    const name = key.slice(2).toLowerCase()
    // 移除上一次绑定的事件处理函数
    prevValue && el.removeEventListener(name, prevValue)
    // 绑定新的事件处理函数
    el.addEventListener(name, nextValue)
  }
  else if (key === 'class') {
    // 省略部分代码
  }
  // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
  else if (shouldSetAsProps(el, key, nextValue)) {
    // 省略部分代码
  } else {
    // 省略部分代码
  }
}
```

其实还有一种性能更优的方式来完成事件更新。在绑定事件时，我们可以绑定一个伪造的事件处理函数 invoker，然后把真正的事件处理函数设置为 invoker.value 属性的值。这样当更新事件的时候，我们将不再需要调用 removeEventListener 函数来移除上一次绑定的事件，只需要更新 invoker.value 的值即可，如下面的代码所示：

```js
patchProps(el, key, prevValue, nextValue) {
  if (/^on/.test(key)) {
    // 获取为该元素伪造的事件处理函数 invoker
    let invoker = el._vei
    const name = key.slice(2).toLowerCase()
    if (nextValue) {
      if (!invoker) {
        // 如果没有invoker，则将一个伪造的invoker缓存到el._vei中，vei是 vue event invoker的首字母缩写
        invoker = el._vei = (e) => {
          // 当伪造的事件函数执行时，会执行真在的事件处理函数
          invoker.value(e)
        }
        // 将真在的事件处理函数赋值给 invoker.value
        invoker.value = nextValue
        // 绑定 invoker 最为事件处理函数
        el.addEventListener(name, invoker)
      } else {
        // 如果 invoker 存在，意味着更新，并且只需要更新invoker.value的值即可
        invoker.value = nextValue
      }
    } else if(invoker){
      // 新的事件绑定函数不存在，且之前绑定的invoker存在，则移除绑定
      el.removeEventListener(name, invoker)
    }
  }
  else if (key === 'class') {
    // 省略部分代码
  }
  // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
  else if (shouldSetAsProps(el, key, nextValue)) {
    // 省略部分代码
  } else {
    // 省略部分代码
  }
}
```

上面的代码注意分为两步：

- 先从 el._vei 中读取对应的 invoker，如果 invoker 不存在，则将伪造的invoker 作为事件处理函数，并将它缓存到 el._vei 属性中。
- 把真正的事件处理函数赋值给 invoker.value 属性，然后把伪造的 invoker 函数作为事件处理函数绑定到元素上。可以看到，当事件触发时，实际上执行的是伪造的事件处理函数，在其内部间接执行了真正的事件处理函数invoker.value(e)。

思考一下，发现上面的代码还是有两个个问题：

1. 那就是el._vei只能缓存一个事件处理函数。如果绑定多个事件，将会出现覆盖的现象；
2. 在原生 DOM 编程中，当多次调用addEventListener 函数为元素绑定同一类型的事件时，多个事件处理函数可以共存

```js
const vnode = {
  type: 'p',
  props: {
    onClick: [
      // 第一个事件处理函数
      () => {
        alert('hello')
      },
      // 第二个事件处理函数
      () => {
        alert('world')
      }
    ],
    onContextmenu: () => {
      alert('contextmenu')
    }
  },
  children: 'text'
}
```

我们应该将el._vei设置为一个对象，它的键为事件名，值为事件处理函数，并且值可以为一个数组，存储多个事件处理函数：

```js
patchProps(el, key, prevValue, nextValue) {
  if (/^on/.test(key)) {
    // 定义 el._vei 为一个对象，存储事件名称和事件处理函数的映射
    const invokers = el._vei || (el._vei = {})
    // 获取为该元素伪造的事件处理函数 invoker
    let invoker = invokers[key]
    const name = key.slice(2).toLowerCase()

    if (nextValue) {
      if (!invoker) {
        // 如果没有invoker，则将一个伪造的invoker缓存到el._vei[key]中，vei是 vue event invoker的首字母缩写

        // 将事件处理函数缓存到 el._vei[key] 下，避免覆盖
        invoker = el._vei[key] = (e) => {
          // 如果 invoker.value 是数组，则遍历它并逐个调用事件处理函数
          if (Array.isArray(invoker.value)) {
            invoker.value.forEach(fn => fn(e))
          } else {
            // 否则直接作为函数调用
            invoker.value(e)
          }
        }

        // 将真在的事件处理函数赋值给 invoker.value
        invoker.value = nextValue
        // 绑定 invoker 最为事件处理函数
        el.addEventListener(name, invoker)
      } else {
        // 如果 invoker 存在，意味着更新，并且只需要更新invoker.value的值即可
        invoker.value = nextValue
      }
    } else if (invoker) {
      // 新的事件绑定函数不存在，且之前绑定的invoker存在，则移除绑定
      el.removeEventListener(name, invoker)
    }
  }
  else if (key === 'class') {
    // 省略部分代码
  }
  // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
  else if (shouldSetAsProps(el, key, nextValue)) {
    // 省略部分代码
  } else {
    // 省略部分代码
  }
}
```

## 8. 事件冒泡和更新的时机问题

屏蔽所有绑定时间晚于事件触发时间的事件处理函数的执行。基于此，我们可以调整 patchProps 函数中关于事件的代码：

```js
patchProps(el, key, prevValue, nextValue) {
    if (/^on/.test(key)) {
      // 定义 el._vei 为一个对象，存储事件名称和事件处理函数的映射
      const invokers = el._vei || (el._vei = {})
      // 获取为该元素伪造的事件处理函数 invoker
      let invoker = invokers[key]
      const name = key.slice(2).toLowerCase()

      if (nextValue) {
        if (!invoker) {
          // 如果没有invoker，则将一个伪造的invoker缓存到el._vei[key]中，vei是 vue event invoker的首字母缩写

          // 将事件处理函数缓存到 el._vei[key] 下，避免覆盖
          invoker = el._vei[key] = (e) => {
            // e.timeStamp 为事件发生的时间
            // 如果事件发生时间早于事件处理函数绑定的时间，则不执行事件处理函数
            if (e.timeStamp < invoker.attached) return
            // 如果 invoker.value 是数组，则遍历它并逐个调用事件处理函数
            if (Array.isArray(invoker.value)) {
              invoker.value.forEach(fn => fn(e))
            } else {
              // 否则直接作为函数调用
              invoker.value(e)
            }
          }

          // 将真在的事件处理函数赋值给 invoker.value
          invoker.value = nextValue
          // 添加invoker.attached属性，存储事件处理函数被绑定的时间。
          invoker.attached = performance.now()
          // 绑定 invoker 最为事件处理函数
          el.addEventListener(name, invoker)
        } else {
          // 如果 invoker 存在，意味着更新，并且只需要更新invoker.value的值即可
          invoker.value = nextValue
        }
      } else if (invoker) {
        // 新的事件绑定函数不存在，且之前绑定的invoker存在，则移除绑定
        el.removeEventListener(name, invoker)
      }
    }
    else if (key === 'class') {
      // 省略部分代码
    }
    // 使用 shouldSetAsProps 函数判断是否作用 DOM Properties 设置
    else if (shouldSetAsProps(el, key, nextValue)) {
      // 省略部分代码
    } else {
      // 省略部分代码
    }
  }
```

我们为伪造的事件处理函数添加了 invoker.attached 属性，用来存储事件处理函数被绑定的时间。然后，在 invoker 执行的时候，通过事件对象的 e.timeStamp 获取事件发生的时间。最后，比较两者，如果事件处理函数被绑定的时间晚于事件发生的时间，则不执行该事件处理函数。

## 9. 更新子节点

对于一个元素来说，它的子节点无非有以下三种情况。

- 没有子节点，此时 vnode.children 的值为 null。
- 具有文本子节点，此时 vnode.children 的值为字符串，代表文本的内容。
- 其他情况，无论是单个元素子节点，还是多个子节点（可能是文本和元素的混合），都可以用数组来表示。

```js
// 补丁（更新DOM）
  function patchElement(n1, n2) {
    const el = n2.el = n1.el
    const oldProps = n1.props
    const newProps = n2.props

    // 第一步：更新props
    for (const key in newProps) {
      if (newProps[key] !== oldProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key])
      }
    }

    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null)
      }
    }

    // 第二步：更新 children
    patchChildren(n1, n2, el)
  }
```

更新子节点是对一个元素进行打补丁的最后一步操作。我们将它封装到 patchChildren 函数中，并将新旧 vnode 以及当前正在被打补丁的 DOM 元素 el 作为参数传递给它。

patchChildren函数的实现：

```js
/**
 * 更新子节点
 * @param {*} n1
 * @param {*} n2
 * @param {*} container
 */
function patchChildren(n1, n2, container) {
  if (typeof n2.children === 'string') {
    // 旧子节点的类型有三种可能：没有子节点、文本子节点、一组子节点
    // 只有当旧子节点为为一组子节点时，才需要逐个卸载，其他情况什么都不需要做
    if (Array.isArray(n1.children)) {
      n1.children.forEach(c => unmount(c))
    }

    // 最后将新的文本内容设置给容器元素
    setElementText(container, n2.children)
  }
  // 新子节点是一组子节点
  else if (Array.isArray(n2.children)) {
    // 判断旧子节点是否也是一组子节点
    if (Array.isArray(n1.children)) {
      // 代码运行到这里，则说明新旧子节点都是一组子节点，这里涉及到核心的 Diff 算法

      // TODO 暂时用暴力的方法处理，后续会使用到 Diff 算法
      // 将旧的一组子节点全部卸载
      n1.children.forEach(c => unmount(c))
      // 将新的一组子节点全部挂载到容器
      n2.children.forEach(c => patch(null, c, container))
    }
    // 旧子节点要么是文本，要么不存在
    else {
      // 无论哪种情况，我们都只需要将容器清空，然后将新的一组子节点组个挂载
      setElementText(container, '')
      n2.children.forEach(c => patch(null, c, container))
    }
  }
  // 新子节点不存在
  else {
    // 旧子节点是一组子节点，需要逐个卸载
    if (Array.isArray(n1.children)) {
      n1.children.forEach(c => c.unmount(c))
    }
    // 旧子节点是文本节点
    else if (typeof n1.children === 'string') {
      // 直接清空
      setElementText(container, '')
    }

    // 如果没有旧子节点，什么也不需要做
  }
}
```

## 10. 文本节点和注释节点

元素节点通过 vnode.type 来描述，是一个字符串，并且表示标签的名称。但是文本节点和注释节点没有标签名称，我们需要人为的创造唯一标识，并将其作为注释节点和文本节点的type属性值。

```js
// 文本节点的type 标识
const Text = Symbol()
const newVNode = {
  type: Text,
  children: '我是一段文本'
}

// 注释节点的 type 标识
const Comment = Symbol()
const newVNode = {
  type: Commont,
  children: '我是注释的内容'
}
```

我们先抽离浏览器特有的API到渲染器的配置项：
```js
const render = createRenderer({
  createElement(tag) {
    // 省略代码内容
  },
  setElementText(el, text) {
    // 省略代码内容
  },
  insert(el, parent, anchor = null) {
    // 省略代码内容
  },
  patchProps(el, key, prevValue, nextValue) {
    // 省略代码内容
  },
  createText(text) {
    return document.createTextNode(text)
  },
  setText(el, text) {
    el.nodeValue = text
  }
})
```

渲染文本内容：

```js
function patch(n1, n2, container) {
  // 如果n1 存在，则对比 n1 和 n2 的类型
  if (n1 && n1.type !== n2.type) {
    // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
    unmount(n1)
    n1 = null
  }

  // 运行到这里说明，n1和n2的类型相同
  const { type } = n2

  if (typeof type === 'string') {
    if (!n1) {
      // n1不存在，意味着挂载，则调用 mountElement 函数完成挂载
      mountElement(n2, container)
    } else {
      // n1存在，意味着补丁
      patchElement(n1, n2)
    }
  } else if (typeof type === 'object') {
    // 如果n2的类型时一个对象，则它描述的是组件
  } else if (type === Text) {
    // 如果没有旧节点，则进行挂载
    if (!n1) {
      // 调用createText 函数创建文本节点
      const el = n2.el = createText(n2.children)
      // 将文本节点插入到容器中
      insert(el, container)
    } else {
      // 说明旧节点存在，只需要使用新文本节点的文本内容更新旧文本节点即可
      const el = n2.el = n1.el
      if (n2.children !== n1.children) {
        setText(el, n2.children)
      }
    }
  }
}
```

注释节点的处理方式与文本节点的处理方式类似。不同的是，我们需要使用`document.createComment` 函数创建注释节点元素。

## 11. Fragment

再vue3中，支持多根节点模板，而在vue2中式不支持的。就是利用 Fragment(片段)节点来实现的。

```js
const Fragment = Symbol()
const vnode = {
  type: Fragment,
  children: [
    {type: 'li', children: 'text 1'}
    {type: 'li', children: 'text 2'}
    {type: 'li', children: 'text 3'}
  ]
}
```

当渲染器渲染 Fragment 类型的虚拟节点时，由于 Fragment 本身并不会渲染任何内容，所以渲染器只会渲染 Fragment 的子节点：

```js
function patch(n1, n2, container) {
  if (n1 && n1.type !== n2.type) {
    unmount(n1)
    n1 = null
  }
  const { type } = n2

  if (typeof type === 'string') {
    // 省略代码内容
  } else if (typeof type === 'object') {
    // 省略代码内容
  } else if (type === Text) {
    // 省略代码内容
  } else if(type === Fragment) {
    if (!n1) {
      // 如果旧节点不存在，则只需要将 Fragment 的 children 逐个挂载即可
      n2.children.forEach(c => patch(null, c, container))
    } else {
      // 如果旧节点存在，则只需要更新 Fragment 的 children 即可
      patchChildren(n1, n2, container)
    }
  }
}
```

需要注意一点，unmount 函数也需要支持 Fragment 类型的虚拟节点的卸载：

```js
function unmount(vnode) {
    // 再卸载时，类型为 Fragment 的节点，需要依次卸载
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c))
      return
    }

    const parent = vnode.el.parentNode
    if (parent) {
      parent.removeChild(vnode)
    }
  }
```

当卸载 Fragment 类型的虚拟节点时，由于 Fragment 本身并不会渲染任何真实 DOM，所以只需要遍历它的 children 数组，并将其中的节点逐个卸载即可。

