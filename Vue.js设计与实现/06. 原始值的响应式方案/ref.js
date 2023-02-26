import {reactive} from './createReactive.js'

export function ref(val) {
  const wrapper = {
    value: val
  }

  // 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并设置值 true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return reactive(wrapper)
}


export function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    }
  }

  // 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并设置值 true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  })

  return wrapper
}


export function toRefs(obj) {
  const ret = {}

  for(const key in obj) {
    ret[key] = toRef(obj, key)
  }

  return ret
}


export function proxyRefs(target) {
  return new Proxy(target, {
    get(terget, key, receiver) {
      const value = Reflect.get(target, value, receiver)
      return value.__v_isRef ? value.value : value
    },
    set(target, value, newValue, receiver) {
      const oldValue = tareget[key]
      // 如果值是一个 Ref, 则设置其对应的 value 属性值
      if(oldValue.__v_isRef) {
        oldValue.value = newValue
        return true
      }
      return Reflect.set(target, key, newValue, receiver)
    }
  })
}
