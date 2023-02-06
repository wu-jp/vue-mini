const arrayProto = Array.prototype;
function defArrayFunc(obj, func, namespace, vm) {
  Object.defineProperty(obj, func, {
    enumerable: true,
    configurable: true,
    value: function (...args) {
      let original = arrayProto[func];
      const result = original.apply(this, args);
      console.log("被修改的属性", getNameSpace(namespace, ""));
      return result;
    },
  });
}

function proxyArr(vm, arr, namespace) {
  let obj = {
    eleType: "Array",
    toString: function () {
      let result = "";
      for (let i = 0; i < arr.length; i++) {
        result += arr[i] + ", ";
      }
      return result.substring(0, result.length - 2);
    },
    push() { },
    pop() { },
    shift() { },
    unShift() { },
    splice() { },
    sort() { },
    reverse() { },
  };
  defArrayFunc.call(vm, obj, "push", namespace, vm);
  defArrayFunc.call(vm, obj, "pop", namespace, vm);
  defArrayFunc.call(vm, obj, "shift", namespace, vm);
  defArrayFunc.call(vm, obj, "unShift", namespace, vm);
  defArrayFunc.call(vm, obj, "splice", namespace, vm);
  defArrayFunc.call(vm, obj, "sort", namespace, vm);
  defArrayFunc.call(vm, obj, "reverse", namespace, vm);
  arr.__proto__ = obj;
  return arr;
}

function constructObjectProxy(vm, obj, namespace) {
  const proxyObj = {};
  for (let prop in obj) {
    Object.defineProperty(proxyObj, prop, {
      configurable: true,
      get() {
        return obj[prop];
      },
      set: function (val) {
        console.log("被修改的属性", getNameSpace(namespace, prop));
        obj[prop] = val;
      },
    });
    Object.defineProperty(vm, prop, {
      configurable: true,
      get() {
        return obj[prop];
      },
      set: function (val) {
        console.log("被修改的属性", getNameSpace(namespace, prop));
        obj[prop] = val;
      },
    });

    // 当属性是一个对象时，递归代理
    if (obj[prop] instanceof Object) {
      proxyObj[prop] = constructProxy(
        vm,
        obj[prop],
        getNameSpace(namespace, prop)
      );
    }
  }
  return proxyObj;
}

export function constructProxy(vm, obj, namespace) {
  let proxyObj = null;
  if (obj instanceof Array) {
    // 代理数组的方法
    proxyObj = new Array(obj.length);
    for (let i = 0; i < proxyObj.length; i++) {
      proxyObj[i] = constructProxy(vm, obj[i], namespace);
    }
    proxyObj = proxyArr(vm, obj, namespace);
  } else if (obj instanceof Object) {
    proxyObj = constructObjectProxy(vm, obj, namespace);
  } else {
    throw new Error("data必须是一个对象或数组");
  }
  return proxyObj;
}

function getNameSpace(nowNameSpace, nowProp) {
  if (nowNameSpace == null || nowNameSpace === "") {
    return nowProp;
  } else if (nowProp == null || nowProp === "") {
    return nowNameSpace;
  } else {
    return nowNameSpace + "." + nowProp;
  }
}
