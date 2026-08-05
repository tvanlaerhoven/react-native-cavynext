// Public: Selectors for finding components in the tree, beyond test hook
// identifiers.
//
// Example
//
//   await spec.press(by.id('LoginScreen.submit'));
//   await spec.exists(by.text('Welcome back'));
//   await spec.fillIn(by.label('Email address'), 'a@b.c');
//   await spec.press(by.role('button'));

// Public: A selector describing how to find a component.
export interface Selector {
  // How to match: by testID, rendered text, accessibility label or role.
  kind: 'id' | 'text' | 'label' | 'role';
  // The value to match. Text selectors also accept a RegExp.
  value: string | RegExp;
}

// Public: Anything the spec helpers accept as a component reference: a test
// hook identifier (string) or a selector.
export type ComponentIdentifier = string | Selector;

// Public: Selector factory.
export const by = {
  // Match on the `testID` prop.
  id(value: string): Selector {
    return { kind: 'id', value };
  },
  // Match on rendered text content (string containment or RegExp).
  text(value: string | RegExp): Selector {
    return { kind: 'text', value };
  },
  // Match on `accessibilityLabel` (or `aria-label` on web).
  label(value: string): Selector {
    return { kind: 'label', value };
  },
  // Match on `accessibilityRole` (or `role`).
  role(value: string): Selector {
    return { kind: 'role', value };
  },
};

export default by;

// Internal: Is this value a Selector?
export function isSelector(value: ComponentIdentifier): value is Selector {
  return typeof value === 'object' && value !== null && 'kind' in value && 'value' in value;
}

// Internal: Human-readable description of an identifier, for error messages.
export function describeIdentifier(identifier: ComponentIdentifier): string {
  if (typeof identifier === 'string') {
    return identifier;
  }
  return `by.${identifier.kind}(${String(identifier.value)})`;
}

// Internal: Collapse a props' `children` into a string. Only string and number
// children are considered; nested elements are handled by walking their own
// fibers.
export function stringifyChildren(children: unknown): string {
  if (children === null || children === undefined || typeof children === 'boolean') {
    return '';
  }
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(stringifyChildren).join('');
  }
  return '';
}

// Internal: Build the predicate a fiber must satisfy for a selector.
export function selectorPredicate(selector: Selector): (props: Record<string, any>) => boolean {
  switch (selector.kind) {
    case 'id':
      return (props) => props.testID === selector.value;
    case 'label':
      return (props) =>
        props.accessibilityLabel === selector.value || props['aria-label'] === selector.value;
    case 'role':
      return (props) => props.accessibilityRole === selector.value || props.role === selector.value;
    case 'text':
      return (props) => {
        const text = stringifyChildren(props.children);
        if (!text) {
          return false;
        }
        return typeof selector.value === 'string'
          ? text.includes(selector.value)
          : selector.value.test(text);
      };
  }
}
