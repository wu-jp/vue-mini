# 只读和浅只读

有些时候我们希望对数据进行保护，例如组件接受的 props 为只读数据。现在来实现一个 readonly 函数，他能将一个数据变成只读的：

```js
const obj = readonly({foo: 1})
// 尝试修改数据，得到警告
obj.foo = 2
```

只读函数，本质也是对数据进行代理，同样用到 createReactive 函数来实现，新增第三个参数 isReadonly ：

```js
// 深只读
export function readonly(obj) {
  return createReactive(obj, false, true)
}

// 浅只读
export function shallowReadonly() {
  return createReactive(obj, true, true)
}

/**
 * 创建响应式数据
 * @param {*} obj 被代理的数据
 * @param {*} isShallow 表示是否为浅响应 默认值false
 * @param {*} isReadonly 表示是否为只可读 默认值false
 * @returns
 */
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') {
        return target
      }

      // 只有非只读的，才需要建立响应联系
      if (!isReadonly) {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        // 如果数据为只读，则调用 readonly 对值进行包装
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }

      const oldVal = target[key]
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const res = Reflect.set(target, key, newVal, receiver)

      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type)
        }
      }
      return res
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }

      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)

      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }
    // 其他拦截函数 ...
  })
}

```

关键点：
- 新增参数 isReadonly，表示是否只读
- 当只读时，get操作不需要建立响应联系
- set 和 delete 操作时，提示警告信息
- 深只读数据，用 readonly 函数包装，而不是用 reactive 函数。
