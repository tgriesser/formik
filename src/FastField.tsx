import * as React from 'react';
import isEqual from 'react-fast-compare';
import { Field } from './Field';
import { validateYupSchema, yupToFormErrors } from './Formik';
import { FormikConsumer } from './context';
import { getIn, isFunction, isPromise, setIn } from './utils';
import { getFieldBag, commonRenderProps } from './internal';

/** @private Returns whether two objects are deeply equal **excluding** a key / dot path */
function isEqualExceptForKey(a: any, b: any, path: string) {
  return isEqual(setIn(a, path, undefined), setIn(b, path, undefined));
}

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */
class FastFieldInner<Values> extends React.Component<
  FastField.InnerCommon<Values>,
  FastField.State
> {
  constructor(props: FastField.InnerCommon<Values>) {
    super(props);
    this.state = {
      value: getIn(props.formik.values, props.name),
      error: getIn(props.formik.errors, props.name),
    };
    const { formik } = props;
    // Register the FastField with the parent Formik. Parent will cycle through
    // registered FastField's validate fns right prior to submit
    formik.registerField(props.name, {
      validate: props.validate,
    });
  }

  componentDidUpdate(prevProps: FastField.InnerCommon<Values>) {
    const nextFieldValue = getIn(this.props.formik.values, this.props.name);
    const nextFieldError = getIn(this.props.formik.errors, this.props.name);
    const prevFieldValue = getIn(prevProps.formik.values, prevProps.name);
    const prevFieldError = getIn(prevProps.formik.errors, prevProps.name);

    if (!isEqual(nextFieldValue, prevFieldValue)) {
      this.setState({ value: nextFieldValue });
    }

    if (!isEqual(nextFieldError, prevFieldError)) {
      this.setState({ error: nextFieldError });
    }

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

  handleChange = (e: React.ChangeEvent<any>) => {
    e.persist();
    const {
      validateOnChange,
      validate,
      values,
      validationSchema,
      errors,
      setFormikState,
    } = this.props.formik;
    const { type, value, checked } = e.target;
    let parsed;
    const val = /number|range/.test(type)
      ? ((parsed = parseFloat(value)), isNaN(parsed) ? '' : parsed)
      : /checkbox/.test(type)
        ? checked
        : value;
    if (validateOnChange) {
      // Field-level validation
      if (this.props.validate) {
        const maybePromise = (this.props.validate as any)(value);
        if (isPromise(maybePromise)) {
          this.setState({ value: val });
          (maybePromise as any).then(
            () => this.setState({ error: undefined }),
            (error: string) => this.setState({ error })
          );
        } else {
          this.setState({ value: val, error: maybePromise });
        }
      } else if (validate) {
        // Top-level validate
        const maybePromise = (validate as any)(
          setIn(values, this.props.name, val)
        );

        if (isPromise(maybePromise)) {
          this.setState({ value: val });
          (maybePromise as any).then(
            () => this.setState({ error: undefined }),
            (error: any) => {
              // Here we diff the errors object relative to Formik parents except for
              // the Field's key. If they are equal, the field's validation function is
              // has no inter-field side-effects and we only need to update local state
              // otherwise we need to lift up the update to the parent (causing a full form render)
              if (isEqualExceptForKey(maybePromise, errors, this.props.name)) {
                this.setState({ error: getIn(error, this.props.name) });
              } else {
                setFormikState((prevState: any) => ({
                  ...prevState,
                  errors: error,
                  // touched: setIn(prevState.touched, name, true),
                }));
              }
            }
          );
        } else {
          // Handle the same diff situation
          // @todo refactor
          if (isEqualExceptForKey(maybePromise, errors, this.props.name)) {
            this.setState({
              value: val,
              error: getIn(maybePromise, this.props.name),
            });
          } else {
            this.setState({
              value: val,
            });
            setFormikState((prevState: any) => ({
              ...prevState,
              errors: maybePromise,
            }));
          }
        }
      } else if (validationSchema) {
        // Top-level validationsSchema
        const schema = isFunction(validationSchema)
          ? validationSchema()
          : validationSchema;
        const mergedValues = setIn(values, this.props.name, val);
        // try to validate with yup synchronously if possible...saves a render.
        try {
          validateYupSchema(mergedValues, schema, true);
          this.setState({
            value: val,
            error: undefined,
          });
        } catch (e) {
          if (e.name === 'ValidationError') {
            this.setState({
              value: val,
              error: getIn(yupToFormErrors(e), this.props.name),
            });
          } else {
            this.setState({
              value: val,
            });
            // try yup async validation
            validateYupSchema(mergedValues, schema).then(
              () => this.setState({ error: undefined }),
              (err: any) =>
                this.setState(s => ({
                  ...s,
                  error: getIn(yupToFormErrors(err), this.props.name),
                }))
            );
          }
        }
      } else {
        this.setState({ value: val });
      }
    } else {
      this.setState({ value: val });
    }
  };

  handleBlur = () => {
    const { validateOnBlur, setFormikState } = this.props.formik;
    const { name, validate } = this.props;

    // @todo refactor
    if (validateOnBlur && validate) {
      const maybePromise = (validate as any)(this.state.value);
      if (isPromise(maybePromise)) {
        (maybePromise as Promise<any>).then(
          () =>
            setFormikState((prevState: any) => ({
              ...prevState,
              values: setIn(prevState.values, name, this.state.value),
              errors: setIn(prevState.errors, name, undefined),
              touched: setIn(prevState.touched, name, true),
            })),
          error =>
            setFormikState((prevState: any) => ({
              ...prevState,
              values: setIn(prevState.values, name, this.state.value),
              errors: setIn(prevState.errors, name, error),
              touched: setIn(prevState.touched, name, true),
            }))
        );
      } else {
        setFormikState((prevState: any) => ({
          ...prevState,
          values: setIn(prevState.values, name, this.state.value),
          errors: setIn(prevState.errors, name, maybePromise),
          touched: setIn(prevState.touched, name, true),
        }));
      }
    } else {
      setFormikState((prevState: any) => ({
        ...prevState,
        errors: setIn(prevState.errors, name, this.state.error),
        values: setIn(prevState.values, name, this.state.value),
        touched: setIn(prevState.touched, name, true),
      }));
    }
  };

  componentWillUnmount() {
    this.props.formik.unregisterField(this.props.name);
  }

  render(): React.ReactNode {
    return this.props.render(getFieldBag(this));
  }
}

export namespace FastField {
  export interface ComponentInterface<Values>
    extends Field.CommonMethods,
      React.Component<InnerCommon<Values>, State> {}
  export interface InnerCommon<Values> extends Field.InnerCommon<Values> {}
  export interface State {
    value: any;
    error?: string;
  }
}

export function FastField<Values, Props = {}>(
  props: Field.Props<Values, Props>
) {
  return (
    <FormikConsumer<Values>>
      {formik => (
        <FastFieldInner<Values> {...commonRenderProps(props)} formik={formik} />
      )}
    </FormikConsumer>
  );
}
