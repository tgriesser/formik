import * as React from 'react';
import { FormikConsumer } from './context';
import { Omit } from './types';
import { isPromise } from './utils';
import { getFieldBag, commonRenderProps } from './internal';
import { Formik } from './Formik';

export namespace Field {
  export interface CommonMethods {
    handleChange(e: React.ChangeEvent<any>): void;
    handleBlur(e: React.ChangeEvent<any>): void;
  }

  export interface ComponentInterface<Values>
    extends CommonMethods,
      React.Component<Field.InnerCommon<Values>> {}

  /**
   * All props passed down to the custom component / render prop
   */
  export interface Bag<Values> {
    field: {
      /** Classic React change handler, keyed by input name */
      onChange: (e: React.ChangeEvent<any>) => void;
      /** Mark input as touched */
      onBlur: (e: any) => void;
      /** Value of the input */
      value: any;
      /* name of the input */
      name: string;
    };
    form: Formik.Props<Values>;
    meta: {
      touched: boolean;
      error: any;
    };
  }

  /**
   * Common interface for all fields, regardless of render method
   */
  export type Common = {
    /**
     * Field name, required
     */
    name: string;
    /**
     * Validate a single field value independently
     */
    validate?: ((value: any) => string | Promise<void> | undefined);
    /**
     * Field type
     */
    type?: string;

    /** Field value */
    value?: any;
  };

  export interface ImplicitInputComponentProps
    extends Common,
      Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value'> {
    innerRef?: (instance: any) => void;
  }

  export interface InputComponentProps extends ImplicitInputComponentProps {
    component: 'input';
  }

  export interface SelectComponentProps
    extends Common,
      Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'value'> {
    component: 'select';
    /** Inner ref */
    innerRef?: (instance: any) => void;
  }

  export interface TextareaComponentProps
    extends Common,
      Omit<
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
        'name' | 'value'
      > {
    component: 'textarea';
    /** Inner ref */
    innerRef?: (instance: any) => void;
  }

  export interface ButtonComponentProps
    extends Common,
      Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name' | 'value'> {
    component: 'textarea';
    /** Inner ref */
    innerRef?: (instance: any) => void;
  }

  /**
   * Render prop (works like React router's <Route render={props =>} />)
   */
  export interface RenderFieldProps<V> extends Common {
    render: ((props: Bag<V>) => React.ReactNode);
  }

  export type CustomComponent<V, P = {}> = React.ComponentType<Bag<V> & P>;

  export interface CustomComponentProps<V, P> extends Common {
    component: CustomComponent<V, P>;
  }

  export interface InnerCommon<V> extends Common, RenderFieldProps<V> {
    formik: Formik.Context<V>;
  }

  export type DOMNodeFieldProps =
    | InputComponentProps
    | SelectComponentProps
    | TextareaComponentProps
    | ButtonComponentProps;

  export type Props<V, P> =
    | DOMNodeFieldProps
    | RenderFieldProps<V>
    | (CustomComponentProps<V, P> & P)
    | ImplicitInputComponentProps;
}

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */
class FieldInner<Values> extends React.Component<Field.InnerCommon<Values>>
  implements Field.CommonMethods {
  constructor(props: Field.InnerCommon<Values>) {
    super(props);
    const { formik } = props;

    // Register the Field with the parent Formik. Parent will cycle through
    // registered Field's validate fns right prior to submit
    formik.registerField(props.name, {
      validate: props.validate,
    });
  }

  componentDidUpdate(prevProps: Field.InnerCommon<Values>) {
    if (this.props.name !== prevProps.name) {
      this.props.formik.unregisterField(prevProps.name);
      this.props.formik.registerField(this.props.name, {
        validate: this.props.validate,
      });
    }

    if (this.props.validate !== prevProps.validate) {
      this.props.formik.registerField(this.props.name, {
        validate: this.props.validate,
      });
    }
  }

  componentWillUnmount() {
    this.props.formik.unregisterField(this.props.name);
  }

  handleChange = (e: React.ChangeEvent<any>) => {
    const { handleChange, validateOnChange } = this.props.formik;
    handleChange(e); // Call Formik's handleChange no matter what
    if (!!validateOnChange && !!this.props.validate) {
      this.runFieldValidations(e.target.value);
    }
  };

  handleBlur = (e: any) => {
    const { handleBlur, validateOnBlur } = this.props.formik;
    handleBlur(e); // Call Formik's handleBlur no matter what
    if (!!validateOnBlur && !!this.props.validate) {
      this.runFieldValidations(e.target.value);
    }
  };

  runFieldValidations = (value: any) => {
    const { setFieldError } = this.props.formik;
    const { name, validate } = this.props;
    // Call validate fn
    const maybePromise = (validate as any)(value);
    // Check if validate it returns a Promise
    if (isPromise(maybePromise)) {
      (maybePromise as Promise<any>).then(
        () => setFieldError(name, undefined as any),
        error => setFieldError(name, error)
      );
    } else {
      // Otherwise set the error
      setFieldError(name, maybePromise);
    }
  };

  render(): React.ReactNode {
    return this.props.render(getFieldBag(this));
  }
}

export function Field<Values, Props>(props: Field.Props<Values, Props>) {
  return (
    <FormikConsumer<Values>>
      {formik => (
        <FieldInner<Values> {...commonRenderProps(props)} formik={formik} />
      )}
    </FormikConsumer>
  );
}
