export function getById(id) {
    return document.getElementById(id);
}

export function hide(element) {
    element.style.display = "none";
}

export function show(element) {
    element.style.display = "";
}

export function isHidden(element) {
    return element.style.display === "none";
}

export function div(className) {
    let element = document.createElement("div");
    element.className = className;
    return element;
}

export function a(className, textContent, href = null) {
    let element = document.createElement("a");
    element.className = className;
    element.textContent = textContent;
    if (href) {
        element.href = href;
    } else {
        element.href = textContent;
    }
    return element;
}

export function span(className, textContent) {
    let element = document.createElement("span");
    element.className = className;
    element.textContent = textContent;
    return element;
}

export function img(src) {
    let element = document.createElement("img");
    element.src = src;
    return element;
}

export function svg(href) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", href);
    svg.appendChild(use);
    return svg;
}

export function button(className, title) {
    let element = document.createElement("button");
    element.className = className;
    element.title = title;
    return element;
}

export function input(className, text, placeholder = null) {
    let element = document.createElement("input");
    element.className = className;
    element.value = text;

    if (placeholder) {
        element.placeholder = placeholder
    }

    return element;
}
