import * as React from 'react';
import { FormikConsumer } from './context';
import { Omit } from './types';
import { isPromise, getFieldBag, commonRenderProps } from './internal';
import { Formik } from './Formik';

export namespace Field {
  export interface CommonMethods {
    handleChange(e: React.ChangeEvent<any>): void;
    handleBlur(e: React.ChangeEvent<any>): void;
  }

  export interface ComponentInterface
    extends CommonMethods,
      React.Component<Field.InnerCommon> {}

  /**
   * All props passed down to the custom component / render prop
   */
  export interface Bag<Values extends object = any> {
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
  export type CommonProps = {
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
    extends CommonProps,
      Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value'> {
    innerRef?: (instance: any) => void;
    component?: never;
    render?: never;
    children?: React.ReactElement<any> | React.ReactElement<any>[];
  }

  export interface InputComponentProps
    extends CommonProps,
      Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'value'> {
    /** Inner ref */
    innerRef?: (instance: any) => void;
    render?: never;
    component: 'input';
    children?: React.ReactElement<any> | React.ReactElement<any>[];
  }

  export interface SelectComponentProps
    extends CommonProps,
      Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'value'> {
    /** Inner ref */
    innerRef?: (instance: any) => void;
    render?: never;
    component: 'select';
    children?: React.ReactElement<any> | React.ReactElement<any>[];
  }

  export interface TextareaComponentProps
    extends CommonProps,
      Omit<
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
        'name' | 'value'
      > {
    /** Inner ref */
    innerRef?: (instance: any) => void;
    render?: never;
    component: 'textarea';
    children?: React.ReactElement<any> | React.ReactElement<any>[];
  }

  export interface ButtonComponentProps
    extends CommonProps,
      Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name' | 'value'> {
    render?: never;
    /** Inner ref */
    innerRef?: (instance: any) => void;
    component: 'button';
    children?: React.ReactElement<any> | React.ReactElement<any>[];
  }

  /**
   * Render prop (works like React router's <Route render={props =>} />)
   */
  export interface RenderFieldProps extends CommonProps {
    innerRef?: never;
    component?: never;
    render: ((props: Field.Bag) => React.ReactNode);
    children?: never;
  }

  /**
   * Render prop (works like React router's <Route render={props =>} />)
   */
  export interface ChildRenderFieldProps extends CommonProps {
    innerRef?: never;
    render?: never;
    component?: never;
    children: ((props: Field.Bag) => React.ReactNode);
  }

  export interface CustomComponentProps<P = {}> extends CommonProps {
    // innerRef shouldn't be valid unless it's explicitly defined in the custom component.
    innerRef?: P extends { innerRef: any } ? P['innerRef'] : never;
    render?: never;
    component: React.ComponentType<Field.Bag & P>;
    children?: React.ReactNode | React.ReactNode[];
  }

  export interface InnerCommon extends CommonProps, RenderFieldProps {
    formik: Formik.Context<any>;
  }

  export type DOMNodeFieldProps =
    | InputComponentProps
    | SelectComponentProps
    | TextareaComponentProps
    | ButtonComponentProps;

  export type Props<P> =
    | RenderFieldProps
    | ChildRenderFieldProps
    | (CustomComponentProps<P> & P)
    | DOMNodeFieldProps
    | ImplicitInputComponentProps;
}

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */
class FieldInner extends React.Component<Field.InnerCommon>
  implements Field.CommonMethods {
  constructor(props: Field.InnerCommon) {
    super(props);
    const { formik } = props;

    // Register the Field with the parent Formik. Parent will cycle through
    // registered Field's validate fns right prior to submit
    formik.registerField(props.name, {
      validate: props.validate,
    });
  }

  componentDidUpdate(prevProps: Field.InnerCommon) {
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
    if (validate) {
      // Call validate fn
      const maybePromise = validate(value);
      // Check if validate it returns a Promise
      if (isPromise(maybePromise)) {
        maybePromise.then(
          () => setFieldError(name, undefined as any),
          error => setFieldError(name, error)
        );
      } else {
        // Otherwise set the error
        setFieldError(name, maybePromise);
      }
    }
  };

  render(): React.ReactNode {
    return this.props.render(getFieldBag(this));
  }
}

export class Field<P = {}> extends React.Component<Field.Props<P>> {
  render() {
    return (
      <FormikConsumer>
        {formik => (
          <FieldInner {...commonRenderProps(this.props)} formik={formik} />
        )}
      </FormikConsumer>
    );
  }
}
