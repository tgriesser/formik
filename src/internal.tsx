import React from 'react';
import { getIn, setIn } from './utils';
import { Field } from './Field';
import { FastField } from './FastField';
import { Formik } from './Formik';

export function commonRenderProps(
  props: Field.Props<{}>
): Field.RenderFieldProps {
  const { name, validate, type, value } = props;
  const render = props.render
    ? props.render
    : isFunction(props.children)
      ? props.children
      : (bag: Field.Bag) => internalFieldRenderer(bag, props);
  return { name, validate, type, value, render };
}

function internalFieldRenderer<P>(
  bag: Field.Bag,
  props: Field.Props<P>
): React.ReactNode {
  if (props.component) {
    if (!isString(props.component)) {
      const {
        component,
        validate,
        ...rest
      } = props as Field.CustomComponentProps<P>;
      return React.createElement(component as React.ComponentType<any>, {
        ...rest,
        ...bag,
      });
    }
    const { innerRef, component, ...rest } = props as Field.DOMNodeFieldProps;
    return React.createElement(component, {
      ref: innerRef,
      ...rest,
      ...bag.field,
    });
  }
  const { innerRef, ...rest } = props as Field.ImplicitInputComponentProps;
  return React.createElement('input', {
    ref: innerRef,
    ...rest,
    ...bag.field,
  });
}

type FieldBagComponent =
  | Field.ComponentInterface
  | FastField.ComponentInterface;

export function getFieldBag(
  component: FieldBagComponent,
  fast: boolean = false
): Field.Bag {
  const {
    props: { validate, type, formik, value, name },
  } = component;
  const {
    validate: _validate,
    validationSchema: _validationSchema,
    ...restOfFormik
  } = formik;
  let finalValue = value;
  if (type !== 'radio' && type !== 'checkbox') {
    if (fast) {
      finalValue = (component as FastField.ComponentInterface).state.value;
    } else {
      finalValue = getIn(formik.values, name);
    }
  }
  const error = fast
    ? (component as FastField.ComponentInterface).state.error
    : getIn(formik.errors, name);
  return {
    field: {
      value: finalValue,
      name,
      onChange: validate ? component.handleChange : formik.handleChange,
      onBlur: validate ? component.handleBlur : formik.handleBlur,
    },
    form: restOfFormik,
    meta: { touched: getIn(formik.touched, name), error },
  };
}

/**
 * Validate a yup schema.
 */
export function validateYupSchema<
  T extends {
    [field: string]: any;
  }
>(
  values: T,
  schema: any,
  sync: boolean = false,
  context: any = {}
): Promise<Partial<T>> {
  let validateData: Partial<T> = {};
  for (let k in values) {
    if (values.hasOwnProperty(k)) {
      const key = String(k);
      validateData[key] = values[key] !== '' ? values[key] : undefined;
    }
  }
  return schema[sync ? 'validateSync' : 'validate'](validateData, {
    abortEarly: false,
    context: context,
  });
}

/**
 * Transform Yup ValidationError to a more usable object
 */
export function yupToFormErrors<Values>(yupError: any): Formik.Errors<Values> {
  let errors: Formik.Errors<Values> = {} as Formik.Errors<Values>;
  for (let err of yupError.inner) {
    if (!(errors as any)[err.path]) {
      errors = setIn(errors, err.path, err.message);
    }
  }
  return errors;
}

// Assertions

/** @private is the given object a Function? */
export const isFunction = (obj: any): obj is Function =>
  typeof obj === 'function';

/** @private is the given object an Object? */
export const isObject = (obj: any): boolean =>
  obj !== null && typeof obj === 'object';

/** @private is the given object an integer? */
export const isInteger = (obj: any): boolean =>
  String(Math.floor(Number(obj))) === obj;

/** @private is the given object a string? */
export const isString = (obj: any): obj is string =>
  Object.prototype.toString.call(obj) === '[object String]';

/** @private is the given object a NaN? */
export const isNaN = (obj: any): boolean => obj !== obj;

/** @private is the given object/value a promise? */
export const isPromise = (value: any): value is PromiseLike<any> =>
  isObject(value) && isFunction(value.then);
