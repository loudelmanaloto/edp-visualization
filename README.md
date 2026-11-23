# Event-Driven Stepper

Interactive, step-by-step visualizations for an Event-Driven Programming course, taught in JavaScript. Every demo can be stepped through with Next / Prev or played as an animation, with a plain-language explanation and the matching line of code highlighted at each step.

Tabs:

- **Event Loop** (`#loop`): paradigms, sync vs. async, callbacks; call stack, Web APIs, task queue and microtask queue.
- **Observer** (`#observer`): observer pattern and pub/sub, subscribe/unsubscribe, listener leaks.
- **Dispatcher** (`#dispatch`): event queue and dispatcher, cascades, custom events, errors with and without try/catch.
- **DOM Events** (`#dom`): capturing, target and bubbling phases, stopPropagation, preventDefault, delegation.
- **Debounce** (`#timing`): debouncing and throttling on a timeline.
- **GUI Events** (`#gui`): an event-driven calculator, from mouse click to repaint.
- **Async Web** (`#async`): fetch with async/await, the Node.js event loop, Express middleware, WebSockets.

Single static page (`index.html`), no build step needed to host it. Hosted with GitHub Pages.

## Activities

The **Activity** tab (`#activity`) is a hub with seven graded activities, one per topic (`#activity-loop`, `#activity-observer`, `#activity-dispatch`, `#activity-dom`, `#activity-timing`, `#activity-gui`, `#activity-async`). Each has 25 items: 20 concept and tracing items plus 5 terminology items. Each student gets their own code snippets and numbers, generated from their student ID. Answers are saved in the browser, graded in the browser when submitted, and students download a result PDF to upload to the class submission page.

Each topic tab also has a filterable **Key terms** glossary. The terms live in `window.EDP_GLOSSARY` and feed the terminology items.
