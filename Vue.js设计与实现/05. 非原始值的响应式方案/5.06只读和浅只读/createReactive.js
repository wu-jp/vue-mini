import { track, trigger } from './effect.js'

// 深响应
export function reactive(obj) {
  return createReactive(obj)
}

// 浅响应
export function shallowReactive(obj) {
  return createReactive(obj, true)
}

// 深只读
export function readonly(obj) {
  return createReactive(obj, false, true)
}

// 浅只读
export function shallowReadonly() {
  return createReactive(obj, true, true)
}


let ITERATE_KEY = Symbol()


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

      // 代理对象可以通过 raw 属性访问原始数据，用于 set 操作时，判断 receiver 是否为target的代理对象
      if (key === 'raw') {
        return target
      }

      // 只有非只读的，才需要建立响应联系
      if (!isReadonly) {
        track(target, key)
      }

      const res = Reflect.get(target, key, receiver)
      // 浅响应，直接返回原始值
      if (isShallow) {
        return res
      }

      // 处理深对象
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
      // 拿到旧的值
      const oldVal = target[key]
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const res = Reflect.set(target, key, newVal, receiver)


      // target === receiver 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        // 当新值和旧值不相同时，才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type)
        }
      }

      // 返回是否操作成功
      return res
    },

    // 通过 has 拦截函数实现 in 操作符
    has(target, key) {
      track(target, key)
      return Reflect.has(track, key)
    },

    // 通过ownKeys 拦截函数，拦截 for...in循环
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },

    // 删除属性的代理
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      // 检查被操作的属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      // 完成属性的删除
      const res = Reflect.deleteProperty(target, key)

      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }

    // 其他拦截函数 ...
  })
}


