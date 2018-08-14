import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Formik, Field, FormikProvider, Omit } from '../src';

import { mount } from '@pisano/enzyme';
import { noop } from './testHelpers';

interface TestFormValues {
  name: string;
  email: string;
}

type TestOmit = 'onSubmit' | 'initialValues';

const TestForm: React.SFC<
  | Omit<Formik.ChildRenderConfig<TestFormValues>, TestOmit>
  | Omit<Formik.ComponentConfig<TestFormValues>, TestOmit>
  | Omit<Formik.RenderConfig<TestFormValues>, TestOmit>
> = p => (
  <Formik
    onSubmit={noop}
    initialValues={{ name: 'jared', email: 'hello@reason.nyc' }}
    {...p}
  />
);

describe('A <Field />', () => {
  describe('<Field validate>', () => {
    const makeFieldTree = ({ formik, ...rest }: any) =>
      mount(
        <FormikProvider value={formik}>
          <Field {...rest} />
        </FormikProvider>
      );

    it('calls validate during onChange if present', () => {
      const handleChange = jest.fn(noop);
      const setFieldError = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          handleChange,
          setFieldError,
          validateOnChange: true,
        },
      });
      tree.find('input').simulate('change', {
        persist: noop,
        target: {
          name: 'name',
          value: 'ian',
        },
      });
      expect(handleChange).toHaveBeenCalled();
      expect(setFieldError).toHaveBeenCalled();
      expect(validate).toHaveBeenCalled();
    });

    it('does NOT call validate during onChange if validateOnChange is set to false', () => {
      const handleChange = jest.fn(noop);
      const setFieldError = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          handleChange,
          setFieldError,
          validateOnChange: false,
        },
      });
      tree.find('input').simulate('change', {
        persist: noop,
        target: {
          name: 'name',
          value: 'ian',
        },
      });
      expect(handleChange).toHaveBeenCalled();
      expect(setFieldError).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
    });

    it('calls validate during onBlur if present', () => {
      const handleBlur = jest.fn(noop);
      const setFieldError = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          handleBlur,
          setFieldError,
          validateOnBlur: true,
        },
      });
      tree.find('input').simulate('blur', {
        persist: noop,
        target: {
          name: 'name',
          value: 'ian',
        },
      });

      expect(handleBlur).toHaveBeenCalled();
      expect(setFieldError).toHaveBeenCalled();
      expect(validate).toHaveBeenCalled();
    });

    it('does NOT call validate during onBlur if validateOnBlur is set to false', () => {
      const handleBlur = jest.fn(noop);
      const setFieldError = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          handleBlur,
          setFieldError,
          validateOnBlur: false,
        },
      });
      tree.find('input').simulate('blur', {
        persist: noop,
        target: {
          name: 'name',
          value: 'ian',
        },
      });
      expect(handleBlur).toHaveBeenCalled();
      expect(setFieldError).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
    });
  });

  describe('<Field component />', () => {
    const node = document.createElement('div');

    const TEXT = 'Mrs. Kato';

    afterEach(() => {
      ReactDOM.unmountComponentAtNode(node);
    });

    it('renders an <input /> by default', () => {
      ReactDOM.render(<TestForm render={() => <Field name="name" />} />, node);

      expect((node.firstChild as HTMLInputElement).name).toBe('name');
    });

    it('renders the component', () => {
      const SuperInput = () => <div>{TEXT}</div>;
      ReactDOM.render(
        <TestForm
          render={() => <Field name="name" component={SuperInput} />}
        />,
        node
      );

      expect((node.firstChild as HTMLInputElement).innerHTML).toBe(TEXT);
    });

    it('renders string components', () => {
      ReactDOM.render(
        <TestForm render={() => <Field component="textarea" name="name" />} />,
        node
      );

      expect((node.firstChild as HTMLTextAreaElement).name).toBe('name');
    });

    it('receives { field, form } props', () => {
      let actual: any; /** Field.Bag ;) */
      let injected: any; /** Field.Bag ;) */
      const Component: React.SFC<Field.Bag> = props => (actual = props) && null;

      ReactDOM.render(
        <TestForm
          render={formikProps =>
            (injected = formikProps) && (
              <Field name="name" component={Component} />
            )
          }
        />,
        node
      );
      const { handleBlur, handleChange } = injected;
      expect(actual.field.name).toBe('name');
      expect(actual.field.value).toBe('jared');
      expect(actual.field.onChange).toBe(handleChange);
      expect(actual.field.onBlur).toBe(handleBlur);
      expect(actual.form).toEqual(injected);
    });

    it('assigns innerRef as a ref to string components', () => {
      const innerRef = jest.fn();
      const tree = mount(
        <FormikProvider value={{ registerField: noop } as any}>
          <Field name="name" innerRef={innerRef} />
        </FormikProvider>
      );
      const element = tree.find('input').instance();
      expect(innerRef).toHaveBeenCalledWith(element);
    });

    it('forwards innerRef to React component', () => {
      let actual: any; /** Field.Bag ;) */
      const Component: React.SFC<
        Field.Bag & { innerRef: jest.Mock<any> }
      > = props => (actual = props) && null;

      const innerRef = jest.fn();

      ReactDOM.render(
        <TestForm
          render={() => (
            <Field name="name" component={Component} innerRef={innerRef} />
          )}
        />,
        node
      );
      expect(actual.innerRef).toBe(innerRef);
    });
  });

  describe('<Field render />', () => {
    const node = document.createElement('div');
    const placeholder = 'First name';
    const TEXT = 'Mrs. Kato';

    afterEach(() => {
      ReactDOM.unmountComponentAtNode(node);
    });

    it('renders its return value', () => {
      ReactDOM.render(
        <TestForm
          render={() => <Field name="name" render={() => <div>{TEXT}</div>} />}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('receives { field, form } props', () => {
      ReactDOM.render(
        <TestForm
          render={formikProps => (
            <Field
              placeholder={placeholder}
              name="name"
              render={({ field, form }: Field.Bag) => {
                const { handleBlur, handleChange } = formikProps;
                expect(field.name).toBe('name');
                expect(field.value).toBe('jared');
                expect(field.onChange).toBe(handleChange);
                expect(field.onBlur).toBe(handleBlur);
                expect(form).toEqual(formikProps);

                return null;
              }}
            />
          )}
        />,
        node
      );
    });
  });

  describe('<Field children />', () => {
    const node = document.createElement('div');

    const TEXT = 'Mrs. Kato';

    afterEach(() => {
      ReactDOM.unmountComponentAtNode(node);
    });

    it('renders a function', () => {
      ReactDOM.render(
        <TestForm
          render={() => (
            <Field name="name" children={() => <div>{TEXT}</div>} />
          )}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('renders a child element', () => {
      ReactDOM.render(
        <TestForm
          render={() => (
            <Field name="name" component="select">
              <option value="Jared" label={TEXT} />
              <option value="Jared" label={TEXT} />
            </Field>
          )}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('renders a child function', () => {
      ReactDOM.render(
        <TestForm
          render={() => <Field name="name">{() => <div>{TEXT}</div>}</Field>}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('receives { field, form } props', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<Field.Bag & { placeholder: string }> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <TestForm
          children={formikProps =>
            (injected = formikProps) && (
              <Field name="name" component={Component} placeholder="hello" />
            )
          }
        />,
        node
      );
      const { handleBlur, handleChange } = injected;
      expect(actual.field.name).toBe('name');
      expect(actual.field.onChange).toBe(handleChange);
      expect(actual.field.onBlur).toBe(handleBlur);
      expect(actual.field.value).toBe('jared');
      expect(actual.form).toEqual(injected);
    });

    it('can resolve bracket paths', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<Field.Bag> = props => (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          children={formikProps =>
            (injected = formikProps) && (
              <Field name="user[superPowers][0]" component={Component} />
            )
          }
        />,
        node
      );
      expect(actual.field.value).toBe('Surging');
    });

    it('can resolve mixed dot and bracket paths', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<Field.Bag> = props => (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          children={formikProps =>
            (injected = formikProps) && (
              <Field name="user.superPowers[1]" component={Component} />
            )
          }
        />,
        node
      );
      expect(actual.field.value).toBe('Binding');
    });

    it('can resolve mixed dot and bracket paths II', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<Field.Bag> = props => (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          children={formikProps =>
            (injected = formikProps) && (
              <Field name="user[superPowers].1" component={Component} />
            )
          }
        />,
        node
      );
      expect(actual.field.value).toBe('Binding');
    });
  });
});
