import * as React from 'react';
import isEqual from 'react-fast-compare';
import warning from 'warning';
import deepmerge from 'deepmerge';
import { FormikProvider } from './context';
import { setIn, setNestedObjectValues, getActiveElement, getIn } from './utils';
import { validateYupSchema, yupToFormErrors } from './internal';
import { isFunction, isNaN, isPromise, isString } from './predicates';
import { mountedFormRegistry, changeListeners } from './listeners';

export namespace Formik {
  /**
   * An object containing error messages whose keys correspond to FormikValues.
   * Should be always be and object of strings, but any is allowed to support i18n libraries.
   */
  export type Values = {
    [field: string]: any;
  };

  /**
   * An object containing error messages whose keys correspond to FormikValues.
   * Should be always be and object of strings, but any is allowed to support i18n libraries.
   */
  export type Errors<Values> = {
    [K in keyof Values]?: Values[K] extends object ? Errors<Values[K]> : any
  };

  /**
   * An object containing touched state of the form whose keys correspond to FormikValues.
   */
  export type Touched<Values> = {
    [K in keyof Values]?: Values[K] extends object
      ? Touched<Values[K]>
      : boolean
  };

  /**
   * Formik state tree
   */
  export interface State<Values> {
    /** Form values */
    values: Values;
    /** Initial form values */
    initialValues: Values;
    /** map of field names to specific error for that field */
    errors: Formik.Errors<Values>;
    /** map of field names to whether the field has been touched */
    touched: Touched<Values>;
    /** whether the form is currently validating */
    isValidating: boolean;
    /** whether the form is currently submitting */
    isSubmitting: boolean;
    /** Top level status state, in case you need it */
    status?: any;
    /** Number of times user tried to submit the form */
    submitCount: number;
  }

  /**
   * Formik computed properties. These are read-only.
   */
  export interface ComputedProps {
    /** True if any input has been touched. False otherwise. */
    readonly dirty: boolean;
    /** Result of isInitiallyValid on mount, then whether true values pass validation. */
    readonly isValid: boolean;
  }

  /**
   * Formik state helpers
   */
  export interface Actions<Values> {
    /** Manually set top level status. */
    setStatus(status?: any): void;
    /** Manually set errors object */
    setErrors(errors: Formik.Errors<Values>): void;
    /** Manually set isSubmitting */
    setSubmitting(isSubmitting: boolean): void;
    /** Manually set touched object */
    setTouched(touched: Touched<Values>): void;
    /** Manually set values object  */
    setValues(values: Values): void;
    /** Set value of form field directly */
    setFieldValue(
      field: Extract<keyof Values, string>,
      value: any,
      shouldValidate?: boolean
    ): void;
    /** Set error message of a form field directly */
    setFieldError(
      field: Extract<keyof Values, string>,
      message: string | undefined
    ): void;
    /** Set whether field has been touched directly */
    setFieldTouched(
      field: Extract<keyof Values, string>,
      isTouched?: boolean,
      shouldValidate?: boolean
    ): void;
    /** Validate form values */
    validateForm(values?: any): void;
    /** Validate field value */
    validateField(field: string): void;
    /** Reset form */
    resetForm(nextValues?: any): void;
    /** Submit the form imperatively */
    submitForm(): void;
    /** Set Formik state, careful! */
    setFormikState<K extends keyof State<Values>>(
      f: (
        prevState: Readonly<State<Values>>,
        props: any
      ) => Pick<State<Values>, K>,
      callback?: () => any
    ): void;
  }

  /**
   * Formik form event handlers
   */
  export interface Handlers {
    /** Form submit handler */
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    /** Reset form event handler  */
    handleReset: () => void;
    /** Classic React blur handler, keyed by input name */
    handleBlur(e: any): void;
    /** Preact-like linkState. Will return a handleBlur function. */
    handleBlur<T = string | any>(
      fieldOrEvent: T
    ): T extends string ? ((e: any) => void) : void;
    /** Classic React change handler, keyed by input name */
    handleChange(e: React.ChangeEvent<any>): void;
    /** Preact-like linkState. Will return a handleChange function.  */
    handleChange<T = string | React.ChangeEvent<any>>(
      field: T
    ): T extends React.ChangeEvent<any>
      ? void
      : ((e: string | React.ChangeEvent<any>) => void);
  }

  /**
   * Base formik configuration/props shared between the HoC and Component.
   */
  export interface SharedConfig {
    /** Tells Formik to validate the form on each input's onChange event */
    validateOnChange?: boolean;
    /** Tells Formik to validate the form on each input's onBlur event */
    validateOnBlur?: boolean;
    /** Tell Formik if initial form values are valid or not on first render */
    isInitialValid?: boolean | ((props: object) => boolean | undefined);
    /** Should Formik reset the form when new initialValues change */
    enableReinitialize?: boolean;
    /** Tells Formik to validate the component on mount */
    validateOnLoad?: boolean;
  }

  export interface CommmonConfig<Values> extends SharedConfig {
    /**
     * Initial values of the form
     */
    initialValues: Values;

    /**
     * Reset handler
     */
    onReset?: (values: Values, formikActions: Actions<Values>) => void;

    /**
     * Submission handler
     */
    onSubmit: (values: Values, formikActions: Actions<Values>) => void;

    /**
     * A Yup Schema or a function that returns a Yup schema
     */
    validationSchema?: any | (() => any);

    /**
     * Validation function. Must return an error object or promise that
     * throws an error object where that object keys map to corresponding value.
     */
    validate?: ((
      values: Values
    ) => void | object | Promise<Formik.Errors<Values>>);
  }

  export interface ComponentConfig<V = Formik.Values> extends CommmonConfig<V> {
    /**
     * Form component to render
     */
    component: React.ComponentType<Props<V>>;
    render?: never;
    children?: React.ReactElement<any>;
  }

  export interface RenderConfig<V = Formik.Values> extends CommmonConfig<V> {
    /**
     * Render prop (works like React router's <Route render={props =>} />)
     */
    render: ((props: Props<V>) => React.ReactNode);
    component?: never;
    children?: never;
  }

  export interface ChildRenderConfig<V = Formik.Values>
    extends CommmonConfig<V> {
    /**
     * Render prop (works like React router's <Route render={props =>} />)
     */
    render?: never;
    component?: never;
    children: ((props: Props<V>) => React.ReactNode) | React.ReactNode;
  }

  /**
   * <Formik /> props
   */
  export type Config<Values = Formik.Values> =
    | ComponentConfig<Values>
    | RenderConfig<Values>
    | ChildRenderConfig<Values>;

  /**
   * State, handlers, and helpers made available to form component or render prop
   * of <Formik/>.
   */
  export interface Props<Values = Formik.Values>
    extends SharedConfig,
      State<Values>,
      Actions<Values>,
      Handlers,
      ComputedProps {
    registerField(
      name: string,
      fns: {
        validate?: ((
          value: any
        ) => string | Function | Promise<void> | undefined);
      }
    ): void;
    unregisterField(name: string): void;
  }

  /**
   * State, handlers, and helpers made available to Formik's primitive components through context.
   */
  export interface Context<Values>
    extends Props<Values>,
      Pick<Config<Values>, 'validate' | 'validationSchema'> {}
}

export class Formik<Values> extends React.Component<
  Formik.Config<Values>,
  Formik.State<Values>
> {
  static defaultProps = {
    validateOnChange: true,
    validateOnBlur: true,
    isInitialValid: false,
    enableReinitialize: false,
    validateOnLoad: false,
  };

  didMount: boolean;
  hcCache: {
    [key: string]: (e: string | React.ChangeEvent<any>) => void;
  } = {};
  hbCache: {
    [key: string]: (e: any) => void;
  } = {};
  fields: {
    [field: string]: {
      validate?: ((value: any) => string | Promise<void> | undefined);
    };
  };

  static getDerivedStateFromProps(
    nextProps: Formik.Config<any>,
    prevState: Formik.State<any>
  ) {
    if (
      nextProps.enableReinitialize &&
      !isEqual(prevState.initialValues, nextProps.initialValues)
    ) {
      return {
        initialValues: nextProps.initialValues,
        ...resetFormState(nextProps.initialValues),
      };
    }
    return null;
  }

  constructor(props: Formik.Config<Values>) {
    super(props);
    this.state = {
      values: props.initialValues || ({} as Values),
      initialValues: props.initialValues || ({} as Partial<Values>),
      errors: {},
      touched: {},
      isSubmitting: false,
      isValidating: false,
      submitCount: 0,
    };
    this.didMount = false;
    this.fields = {};
  }

  registerField = (
    name: string,
    fns: {
      reset?: ((nextValues?: any) => void);
      validate?: ((value: any) => string | Promise<void> | undefined);
    }
  ) => {
    this.fields[name] = fns;
  };

  unregisterField = (name: string) => {
    delete this.fields[name];
  };

  componentDidMount() {
    this.didMount = true;
    if (this.props.validateOnLoad) {
      this.runValidations(this.state.values);
    }
    if (process.env.NODE_ENV === 'development') {
      mountedFormRegistry.push(this);
      changeListeners.forEach(fn => fn(mountedFormRegistry));
    }
  }

  componentWillUnmount() {
    // This allows us to prevent setting state on an
    // unmounted component. This can occur if Formik is in a modal, and submission
    // toggles show/hide, and validation of a blur field takes longer than validation
    // before a submit.
    // @see https://github.com/jaredpalmer/formik/issues/597
    // @see https://reactjs.org/blog/2015/12/16/ismounted-antipattern.html
    this.didMount = false;
    if (process.env.NODE_ENV === 'development') {
      mountedFormRegistry.splice(mountedFormRegistry.indexOf(this), 1);
      changeListeners.forEach(fn => fn(mountedFormRegistry));
    }
  }

  componentDidUpdate() {
    if (process.env.NODE_ENV === 'development') {
      changeListeners.forEach(fn => fn(mountedFormRegistry));
    }
  }

  setErrors = (errors: Formik.Errors<Values>) => {
    this.setState({ errors });
  };

  setTouched = (touched: Formik.Touched<Values>) => {
    this.setState({ touched }, () => {
      if (this.props.validateOnBlur) {
        this.runValidations(this.state.values);
      }
    });
  };

  setValues = (values: Values) => {
    this.setState({ values }, () => {
      if (this.props.validateOnChange) {
        this.runValidations(values);
      }
    });
  };

  setStatus = (status?: any) => {
    this.setState({ status });
  };

  setSubmitting = (isSubmitting: boolean) => {
    this.setState({ isSubmitting });
  };

  /**
   * Run field level validation
   */
  validateField = (field: string) => {
    this.setState({ isValidating: true });
    this.runSingleFieldLevelValidation(
      field,
      getIn(this.state.values, field)
    ).then(error => {
      if (this.didMount) {
        this.setState({
          errors: setIn(this.state.errors, field, error),
          isValidating: false,
        });
      }
    });
  };

  runSingleFieldLevelValidation = (
    field: string,
    value: void | string
  ): Promise<string | undefined | PromiseLike<any>> => {
    return new Promise(resolve => resolve(this.fields[field].validate!(value)));
  };

  runFieldLevelValidations(values: Values): Promise<Formik.Errors<Values>> {
    const fieldKeysWithValidation: string[] = Object.keys(this.fields).filter(
      f =>
        this.fields &&
        this.fields[f] &&
        this.fields[f].validate &&
        isFunction(this.fields[f].validate)
    );

    // Construct an array with all of the field validation functions
    const fieldValidations: Promise<string>[] =
      fieldKeysWithValidation.length > 0
        ? fieldKeysWithValidation.map(
            f =>
              this.runSingleFieldLevelValidation(f, getIn(values, f)).then(
                x => x,
                e => e
              ) // always catch so Promise.all runs each one
          )
        : [Promise.resolve('DO_NOT_DELETE_YOU_WILL_BE_FIRED')]; // use special case ;)

    return Promise.all(fieldValidations).then((fieldErrorsList: string[]) =>
      fieldErrorsList.reduce(
        (prev, curr, index) => {
          if (curr === 'DO_NOT_DELETE_YOU_WILL_BE_FIRED') {
            return prev;
          }
          if (!!curr) {
            prev = setIn(prev, fieldKeysWithValidation[index], curr);
          }
          return prev;
        },
        {} as Formik.Errors<Values>
      )
    );
  }

  runValidateHandler(values: Values): Promise<Formik.Errors<Values>> {
    return new Promise(resolve => {
      const maybePromisedErrors = (this.props.validate as any)(values);
      if (maybePromisedErrors === undefined) {
        resolve({});
      } else if (isPromise(maybePromisedErrors)) {
        maybePromisedErrors.then(
          () => {
            resolve({});
          },
          errors => {
            resolve(errors);
          }
        );
      } else {
        resolve(maybePromisedErrors);
      }
    });
  }

  /**
   * Run validation against a Yup schema and optionally run a function if successful
   */
  runValidationSchema = (values: Values) => {
    return new Promise(resolve => {
      const { validationSchema } = this.props;
      const schema = isFunction(validationSchema)
        ? validationSchema()
        : validationSchema;
      validateYupSchema(values, schema).then(
        () => {
          resolve({});
        },
        (err: any) => {
          resolve(yupToFormErrors<Values>(err));
        }
      );
    });
  };

  /**
   * Run all validations methods and update state accordingly
   */
  runValidations = (
    values: Values = this.state.values
  ): Promise<Formik.Errors<Values>> => {
    this.setState({ isValidating: true });
    return Promise.all([
      this.runFieldLevelValidations(values),
      this.props.validationSchema ? this.runValidationSchema(values) : {},
      this.props.validate ? this.runValidateHandler(values) : {},
    ]).then(([fieldErrors, schemaErrors, handlerErrors]) => {
      const combinedErrors = deepmerge.all<Formik.Errors<Values>>([
        fieldErrors,
        schemaErrors,
        handlerErrors,
      ]);

      if (this.didMount) {
        this.setState({ isValidating: false, errors: combinedErrors });
      }

      return combinedErrors;
    });
  };

  handleChange = (
    eventOrPath: string | React.ChangeEvent<any>
  ): void | ((eventOrTextValue: string | React.ChangeEvent<any>) => void) => {
    // @todo someone make this less disgusting.
    //
    // executeChange is the core of handleChange, we'll use it cache change
    // handlers like Preact's linkState.
    const executeChange = (
      eventOrTextValue: string | React.ChangeEvent<any>,
      maybePath?: string
    ) => {
      // By default, assume that the first argument is a string. This allows us to use
      // handleChange with React Native and React Native Web's onChangeText prop which
      // provides just the value of the input.
      let field = maybePath;
      let val = eventOrTextValue;
      let parsed;
      // If the first argument is not a string though, it has to be a synthetic React Event (or a fake one),
      // so we handle like we would a normal HTML change event.
      if (!isString(eventOrTextValue)) {
        // If we can, persist the event
        // @see https://reactjs.org/docs/events.html#event-pooling
        if ((eventOrTextValue as React.ChangeEvent<any>).persist) {
          (eventOrTextValue as React.ChangeEvent<any>).persist();
        }
        const {
          type,
          name,
          id,
          value,
          checked,
          outerHTML,
        } = (eventOrTextValue as React.ChangeEvent<any>).target;
        field = maybePath ? maybePath : name ? name : id;
        if (!field && process.env.NODE_ENV !== 'production') {
          warnAboutMissingIdentifier({
            htmlContent: outerHTML,
            documentationAnchorLink: 'handlechange-e-reactchangeeventany--void',
            handlerName: 'handleChange',
          });
        }
        val = /number|range/.test(type)
          ? ((parsed = parseFloat(value)), isNaN(parsed) ? '' : parsed)
          : /checkbox/.test(type)
            ? checked
            : value;
      }

      if (field) {
        // Set form fields by name
        this.setState(prevState => ({
          ...prevState,
          values: setIn(prevState.values, field!, val),
        }));

        if (this.props.validateOnChange) {
          this.runValidations(setIn(this.state.values, field, val));
        }
      }
    };

    // Actually execute logic above....
    // cache these handlers by key like Preact's linkState does for perf boost
    if (isString(eventOrPath)) {
      return isFunction(this.hcCache[eventOrPath])
        ? this.hcCache[eventOrPath] // return the cached handled
        : (this.hcCache[eventOrPath] = (
            // make a new one
            event: React.ChangeEvent<any> | string
          ) =>
            executeChange(
              event /* string or event, does not matter */,
              eventOrPath /* this is path to the field now */
            ));
    } else {
      executeChange(eventOrPath);
    }
  };

  setFieldValue = (
    field: string,
    value: any,
    shouldValidate: boolean = true
  ) => {
    // Set form field by name
    this.setState(
      prevState => ({
        ...prevState,
        values: setIn(prevState.values, field, value),
      }),
      () => {
        if (this.props.validateOnChange && shouldValidate) {
          this.runValidations(this.state.values);
        }
      }
    );
  };

  handleSubmit = (e: React.FormEvent<HTMLFormElement> | undefined) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Warn if form submission is triggered by a <button> without a
    // specified `type` attribute during development. This mitigates
    // a common gotcha in forms with both reset and submit buttons,
    // where the dev forgets to add type="button" to the reset button.
    if (
      process.env.NODE_ENV !== 'production' &&
      typeof document !== 'undefined'
    ) {
      // Safely get the active element (works with IE)
      const activeElement = getActiveElement();
      if (
        activeElement !== null &&
        activeElement instanceof HTMLButtonElement
      ) {
        warning(
          !!(
            activeElement.attributes &&
            activeElement.attributes.getNamedItem('type')
          ),
          'You submitted a Formik form using a button with an unspecified `type` attribute.  Most browsers default button elements to `type="submit"`. If this is not a submit button, please add `type="button"`.'
        );
      }
    }

    this.submitForm();
  };

  submitForm = () => {
    // Recursively set all values to `true`.
    this.setState(prevState => ({
      touched: setNestedObjectValues<Formik.Touched<Values>>(
        prevState.values,
        true
      ),
      isSubmitting: true,
      submitCount: prevState.submitCount + 1,
    }));

    return this.runValidations().then(combinedErrors => {
      const isValid = Object.keys(combinedErrors).length === 0;
      if (isValid) {
        this.executeSubmit();
      } else {
        this.setState({ isSubmitting: false });
      }
    });
  };

  executeSubmit = () => {
    this.props.onSubmit(this.state.values, this.getFormikActions());
  };

  handleBlur = (eventOrString: any): void | ((e: any) => void) => {
    const executeBlur = (e: any, path?: string) => {
      if (e.persist) {
        e.persist();
      }
      const { name, id, outerHTML } = e.target;
      const field = path ? path : name ? name : id;

      if (!field && process.env.NODE_ENV !== 'production') {
        warnAboutMissingIdentifier({
          htmlContent: outerHTML,
          documentationAnchorLink: 'handleblur-e-any--void',
          handlerName: 'handleBlur',
        });
      }

      this.setState(prevState => ({
        touched: setIn(prevState.touched, field, true),
      }));

      if (this.props.validateOnBlur) {
        this.runValidations(this.state.values);
      }
    };

    if (isString(eventOrString)) {
      // cache these handlers by key like Preact's linkState does for perf boost
      return isFunction(this.hbCache[eventOrString])
        ? this.hbCache[eventOrString]
        : (this.hbCache[eventOrString] = (event: any) =>
            executeBlur(event, eventOrString));
    } else {
      executeBlur(eventOrString);
    }
  };

  setFieldTouched = (
    field: string,
    touched: boolean = true,
    shouldValidate: boolean = true
  ) => {
    // Set touched field by name
    this.setState(
      prevState => ({
        ...prevState,
        touched: setIn(prevState.touched, field, touched),
      }),
      () => {
        if (this.props.validateOnBlur && shouldValidate) {
          this.runValidations(this.state.values);
        }
      }
    );
  };

  setFieldError = (field: string, message: string | undefined) => {
    // Set form field by name
    this.setState(prevState => ({
      ...prevState,
      errors: setIn(prevState.errors, field, message),
    }));
  };

  resetForm = (nextValues?: Values) => {
    this.setState(
      resetFormState<Values>(nextValues ? nextValues : this.state.initialValues)
    );
  };

  handleReset = () => {
    if (this.props.onReset) {
      const maybePromisedOnReset = this.props.onReset(
        this.state.values,
        this.getFormikActions()
      );

      if (isPromise(maybePromisedOnReset)) {
        maybePromisedOnReset.then(this.resetForm);
      } else {
        this.resetForm();
      }
    } else {
      this.resetForm();
    }
  };

  setFormikState = (s: any, callback?: (() => void)) =>
    this.setState(s, callback);

  getFormikActions = (): Formik.Actions<Values> => {
    return {
      resetForm: this.resetForm,
      submitForm: this.submitForm,
      validateForm: this.runValidations,
      validateField: this.validateField,
      setErrors: this.setErrors,
      setFieldError: this.setFieldError,
      setFieldTouched: this.setFieldTouched,
      setFieldValue: this.setFieldValue,
      setStatus: this.setStatus,
      setSubmitting: this.setSubmitting,
      setTouched: this.setTouched,
      setValues: this.setValues,
      setFormikState: this.setFormikState,
    };
  };

  getFormikComputedProps = () => {
    const { isInitialValid } = this.props;
    const dirty = !isEqual(this.state.initialValues, this.state.values);
    return {
      dirty,
      isValid: dirty
        ? this.state.errors && Object.keys(this.state.errors).length === 0
        : isInitialValid !== false && isFunction(isInitialValid)
          ? (isInitialValid as (props: this['props']) => boolean)(this.props)
          : (isInitialValid as boolean),
      initialValues: this.state.initialValues,
    };
  };

  getFormikBag = () => {
    return {
      ...this.state,
      ...this.getFormikActions(),
      ...this.getFormikComputedProps(),
      // Field needs to communicate with Formik during resets
      registerField: this.registerField,
      unregisterField: this.unregisterField,
      handleBlur: this.handleBlur,
      handleChange: this.handleChange,
      handleReset: this.handleReset,
      handleSubmit: this.handleSubmit,
      validateOnChange: this.props.validateOnChange,
      validateOnBlur: this.props.validateOnBlur,
    };
  };

  getFormikContext = (): Formik.Context<Values> => {
    return {
      ...this.getFormikBag(),
      validationSchema: this.props.validationSchema,
      validate: this.props.validate,
    };
  };

  render() {
    const ctx = this.getFormikContext();
    const props = this.getFormikBag();
    let child: React.ReactNode = null;
    const { render, children, component } = this.props;
    if (render) {
      child = render(props);
    } else if (component) {
      child = React.createElement(component, props);
    } else if (children) {
      child = isFunction(children)
        ? children(props)
        : React.Children.only(children);
    }
    return <FormikProvider value={ctx}>{child}</FormikProvider>;
  }
}

function resetFormState<V>(values: V) {
  return {
    isSubmitting: false,
    isValidating: false,
    errors: {},
    touched: {},
    status: undefined,
    values,
    submitCount: 0,
  };
}

function warnAboutMissingIdentifier({
  htmlContent,
  documentationAnchorLink,
  handlerName,
}: {
  htmlContent: string;
  documentationAnchorLink: string;
  handlerName: string;
}) {
  console.error(
    `Warning: Formik called \`${handlerName}\`, but you forgot to pass an \`id\` or \`name\` attribute to your input:

    ${htmlContent}

    Formik cannot determine which value to update. For more info see https://github.com/jaredpalmer/formik#${documentationAnchorLink}
  `
  );
}
