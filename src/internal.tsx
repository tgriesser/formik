import React from 'react';
import { isString, getIn } from './utils';
import { Field } from './Field';
import { FastField } from './FastField';

export function commonRenderProps<Values>(
  props: Field.Common & { render?: (bag: Field.Bag<Values>) => React.ReactNode }
): Field.RenderFieldProps<Values> {
  const { name, validate, type, value } = props;
  const render = props.render
    ? props.render
    : (bag: Field.Bag<Values>) => internalFieldRenderer<Values>(bag, props);
  return { name, validate, type, value, render };
}

function internalFieldRenderer<Values>(
  bag: Field.Bag<Values>,
  props: Field.Props<Values, any>
): React.ReactNode {
  if ('component' in props) {
    if (!isString(props.component)) {
      const {
        component,
        validate,
        name,
        ...rest
      } = props as Field.CustomComponentProps<Values, any>;
      return React.createElement(
        component as Field.CustomComponent<Values, any>,
        {
          ...rest,
          ...bag,
        } as any
      );
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

type FieldBagComponent<Values> =
  | Field.ComponentInterface<Values>
  | FastField.ComponentInterface<Values>;

export function getFieldBag<Values>(
  component: FieldBagComponent<Values>,
  fast: boolean = false
): Field.Bag<Values> {
  const {
    props: { type, formik, value },
  } = component;
  const {
    validate: _validate,
    validationSchema: _validationSchema,
    ...restOfFormik
  } = formik;
  let finalValue = value;
  if (type !== 'radio' && type !== 'checkbox') {
    if (fast) {
      finalValue = (component as FastField.ComponentInterface<Values>).state
        .value;
    } else {
      finalValue = getIn(formik.values, name);
    }
  }
  const error = fast
    ? (component as FastField.ComponentInterface<Values>).state.error
    : getIn(formik.errors, name);
  return {
    field: {
      value: finalValue,
      name,
      onChange: component.handleChange,
      onBlur: component.handleBlur,
    },
    form: restOfFormik,
    meta: { touched: getIn(formik.touched, name), error },
  };
}
