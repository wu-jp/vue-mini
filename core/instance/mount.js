import VNode from "../vdom/vnode.js";

export function mount(vm, elm) {
  vm._vnode = constructVNode(vm, elm, null);
}

function constructVNode(vm, elm, parent) {
  let vnode = null;
  let children = [];
  let text = getNodeText(elm);
  let data = null;
  let nodeType = elm.nodeType;
  let tag = elm.nodeName;
  vnode = new VNode(tag, elm, children, text, data, parent, nodeType, "");
  let childs = vnode.elm.childNodes;
  for (let i = 0; i < childs.length; i++) {
    let childNodes = constructVNode(vm, childs[i], vnode);
    if (childNodes instanceof VNode) {
      vnode.children.push(childNodes);
    } else {
      vnode.children = vnode.children.concat(childNodes);
    }
  }
  return vnode;
}

function getNodeText(elm) {
  if (elm.nodeType === 3) {
    return elm.nodeValue;
  } else {
    return "";
  }
}
