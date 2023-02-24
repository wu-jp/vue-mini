# 代理数组

数组元素或属性的读取操作：
- 通过索引访问数组元素值：`arr[0]`
- 访问数组的长度：`arr.length`
- 把数组作为对象，使用 `for...in` 循环遍历
- 使用 `for...of` 迭代遍历数组
- 数组的原型方法，如 `concat、join、every、some、find、findIndex、includes` 等，以及其他所有不改变原数组的原型方法

数组元素或属性的设置操作：
- 通过索引修改数组元素值：`arr[1] = 1`
- 修改数组的长度：`arr.length = 0`
- 数组的栈方法：`push、pop、shift、unshift`
- 修改原数组的原型方法：`splice、fill、sort` 等

除了通过数组索引修改数组元素值这种基本操作之外，数组本身还有很多会修改原数组的原型方法。调用这些方法也属于对数组的操作，有些方法的操作语义是“读取”，而有些方法的操作语义是“设置”。因此，当这些操作发生时，也应该正确地建立响应联系或触发响应。

## 数组的索引和 length

当修改 length 属性值时，只有那些索引值大于或等于新的 length 属性值的元素才需要触发响应。

```js
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    set(target, key, newVal, receiver) {
      // target 为数组的情况下 key === 'length' ，newVal为数组的新长度
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }

      const oldVal = target[key]

      // 如果属性不存在，说明是在添加新属性，否则是设置已有属性
      const type = Array.isArray(target)
        // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度
        // 如果是，则视为 SET 操作, 否则为 ADD 操作
        ? newVal < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      const res = Reflect.set(target, key, newVal, receiver)
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 新增第四个参数，即触发响应的新增
          trigger(target, key, type, newVal)
        }
      }
      return res
    },
    // 其他拦截函数 ...
  })
}
```

```js
export function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  // 如果操作的目标对象是数组，并修改了数组长度
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  // 非数组；只有当操作为 ‘ADD’ 或者 ‘DELETE’ 时，才触发 ITERATE_KEY 相关的依赖重新执行
  else if (type === 'ADD' || type === 'DELETE') {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
```
