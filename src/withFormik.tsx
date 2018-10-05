import * as React from 'react';
import { Formik } from './Formik';
import { isFunction } from './predicates';

export namespace WithFormik {
  /**
   * State, handlers, and helpers injected as props into the wrapped form component.
   * Used with withFormik()
   */
  export type InjectedProps<Props, Values> = Props &
    Formik.State<Values> &
    Formik.Actions<Values> &
    Formik.Handlers &
    Formik.ComputedProps;

  /**
   * Formik actions + { props }
   */
  export type FormikBag<P, V> = { props: P } & Formik.Actions<V>;

  /**
   * withFormik() configuration options. Backwards compatible.
   */
  export interface Config<Props, Values extends Formik.Values = Formik.Values>
    extends Formik.SharedConfig {
    /**
     * Set the display name of the component. Useful for React DevTools.
     */
    displayName?: string;

    /**
     * Submission handler
     */
    handleSubmit: (values: Values, formikBag: FormikBag<Props, Values>) => void;

    /**
     * Reset handler
     */
    handleReset: (
      values: Values,
      formikActions: Formik.Actions<Values>
    ) => void;

    /**
     * Map props to the form values
     */
    mapPropsToValues?: (props: Props) => Values;

    /**
     * A Yup Schema or a function that returns a Yup schema
     */
    validationSchema?: any | ((props: Props) => any);

    /**
     * Validation function. Must return an error object or promise that
     * throws an error object where that object keys map to corresponding value.
     */
    validate?: (values: Values, props: Props) => void | object | Promise<any>;

    /**
     * Optional prop to ref the formik object
     */
    formikRef?: React.Ref<Formik<Values>>;
  }

  export type CompositeComponent<P> =
    | React.ComponentClass<P>
    | React.StatelessComponent<P>;

  export interface ComponentDecorator<TOwnProps, TMergedProps> {
    (component: CompositeComponent<TMergedProps>): React.ComponentType<
      TOwnProps
    >;
  }

  export interface InferableComponentDecorator<TOwnProps> {
    <T extends CompositeComponent<TOwnProps>>(component: T): T;
  }
}

/**
 * A public higher-order component to access the imperative API
 */
export function withFormik<Props, Values extends Formik.Values = any>({
  mapPropsToValues = (vanillaProps: Props): Values => {
    let val: Values = {} as Values;
    for (let k in vanillaProps) {
      if (
        vanillaProps.hasOwnProperty(k) &&
        typeof vanillaProps[k] !== 'function'
      ) {
        val[k] = vanillaProps[k];
      }
    }
    return val as Values;
  },
  handleSubmit,
  formikRef,
  ...config
}: WithFormik.Config<Props, Values>): WithFormik.ComponentDecorator<
  Props,
  WithFormik.InjectedProps<Props, Values>
> {
  return function createFormik(
    Component: WithFormik.CompositeComponent<
      WithFormik.InjectedProps<Props, Values>
    >
  ): React.ComponentClass<Props> {
    const componentDisplayName =
      Component.displayName ||
      Component.name ||
      (Component.constructor && Component.constructor.name) ||
      'Component';
    /**
     * We need to use closures here for to provide the wrapped component's props to
     * the respective withFormik config methods.
     */
    class WithFormikWrapper extends React.Component<Props, {}> {
      static displayName = `WithFormik(${componentDisplayName})`;

      validate = (values: Values): void | object | Promise<any> => {
        return config.validate!(values, this.props);
      };

      validationSchema = () => {
        return isFunction(config.validationSchema)
          ? config.validationSchema!(this.props)
          : config.validationSchema;
      };

      handleSubmit = (values: Values, actions: Formik.Actions<Values>) => {
        return handleSubmit(values, {
          ...actions,
          props: this.props,
        });
      };

      /**
       * Just avoiding a render callback for perf here
       */
      renderFormComponent = (formikProps: Formik.Props<Values>) => {
        return <Component {...this.props} {...formikProps} />;
      };

      render() {
        return (
          <Formik
            {...config}
            ref={formikRef}
            validate={config.validate && this.validate}
            validationSchema={config.validationSchema && this.validationSchema}
            onReset={config.handleReset}
            initialValues={mapPropsToValues(this.props)}
            onSubmit={this.handleSubmit}
            render={this.renderFormComponent}
          />
        );
      }
    }

    return WithFormikWrapper;
  };
}
