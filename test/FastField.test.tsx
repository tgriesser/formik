import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { FastField, Formik, FormikProvider, Omit } from '../src';

import { mount } from '@pisano/enzyme';
import { noop } from './testHelpers';

interface TestFormValues {
  name: string;
  email: string;
}

type TestOmit = 'onSubmit' | 'initialValues';

const TestForm: React.SFC<
  | Omit<Formik.ComponentConfig<TestFormValues>, TestOmit>
  | Omit<Formik.RenderConfig<TestFormValues>, TestOmit>
> = p => (
  <Formik
    onSubmit={noop}
    initialValues={{ name: 'jared', email: 'hello@reason.nyc' }}
    {...p}
  />
);

describe('A <FastField />', () => {
  describe('<FastField validate>', () => {
    const makeFieldTree = ({ formik, ...rest }: any) =>
      mount(
        <FormikProvider value={formik}>
          <FastField {...rest} />
        </FormikProvider>
      );

    it('calls validate during onChange if present', () => {
      const registerField = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField,
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
      expect(validate).toHaveBeenCalled();
    });

    it('does NOT call validate during onChange if validateOnChange is set to false', () => {
      const registerField = jest.fn(noop);
      const validate = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField,
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

      expect(validate).not.toHaveBeenCalled();
    });

    it('calls validate during onBlur if present', () => {
      const validate = jest.fn(noop);

      const setFormikState = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          setFormikState,
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
      expect(setFormikState).toHaveBeenCalled();
      expect(validate).toHaveBeenCalled();
    });

    it('does NOT call validate during onBlur if validateOnBlur is set to false', () => {
      const validate = jest.fn(noop);

      const setFormikState = jest.fn(noop);
      const tree = makeFieldTree({
        name: 'name',
        validate,
        formik: {
          registerField: noop,
          unregisterField: noop,
          setFormikState,
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
      expect(setFormikState).toHaveBeenCalled();
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
      ReactDOM.render(
        <TestForm render={() => <FastField name="name" />} />,
        node
      );

      expect((node.firstChild as HTMLInputElement).name).toBe('name');
    });

    it('renders the component', () => {
      const SuperInput = () => <div>{TEXT}</div>;
      ReactDOM.render(
        <TestForm
          render={() => <FastField name="name" component={SuperInput} />}
        />,
        node
      );

      expect((node.firstChild as HTMLInputElement).innerHTML).toBe(TEXT);
    });

    it('renders string components', () => {
      ReactDOM.render(
        <TestForm
          render={() => <FastField component="textarea" name="name" />}
        />,
        node
      );

      expect((node.firstChild as HTMLTextAreaElement).name).toBe('name');
    });

    it('receives { field, form } props', () => {
      let actual: any; /** FastField.Props<any> ;) */
      let injected: any; /** FastField.Props<any> ;) */
      const Component: React.SFC<FastField.Props<any>> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <TestForm
          render={formikProps =>
            (injected = formikProps) && (
              <FastField name="name" component={Component} />
            )
          }
        />,
        node
      );

      expect(actual.field.name).toBe('name');
      expect(actual.field.value).toBe('jared');
      expect(actual.form).toEqual(injected);
    });

    it('assigns innerRef as a ref to string components', () => {
      const innerRef = jest.fn();
      const fmk = {
        registerField: noop,
        unregisterField: noop,
      };
      const tree = mount(
        <FormikProvider value={fmk as any}>
          <FastField name="name" innerRef={innerRef} />
        </FormikProvider>
      );
      const element = tree.find('input').instance();
      expect(innerRef).toHaveBeenCalledWith(element);
    });

    it('forwards innerRef to React component', () => {
      let actual: any;
      const Component: React.SFC<
        FastField.Bag & { innerRef: jest.Mock<any> }
      > = props => (actual = props) && null;

      const innerRef = jest.fn();

      ReactDOM.render(
        <TestForm
          render={() => (
            <FastField name="name" component={Component} innerRef={innerRef} />
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
          render={() => (
            <FastField name="name" render={() => <div>{TEXT}</div>} />
          )}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('receives { field, form } props', () => {
      ReactDOM.render(
        <TestForm
          render={formikProps => (
            <FastField
              placeholder={placeholder}
              name="name"
              render={({ field, form }) => {
                expect(field.name).toBe('name');
                expect(field.value).toBe('jared');
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
            <FastField name="name" render={() => <div>{TEXT}</div>} />
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
            <FastField name="name" component="select">
              <option value="Jared" label={TEXT} />
              <option value="Jared" label={TEXT} />
            </FastField>
          )}
        />,
        node
      );

      expect(node.innerHTML).toContain(TEXT);
    });

    it('receives { field, form } props', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<FastField.Bag> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <TestForm
          render={formikProps =>
            (injected = formikProps) && (
              <FastField
                name="name"
                component={Component}
                placeholder="hello"
              />
            )
          }
        />,
        node
      );
      expect(actual.field.name).toBe('name');
      expect(actual.field.value).toBe('jared');
      expect(actual.form).toEqual(injected);
    });

    it('can resolve bracket paths', () => {
      let actual: any;
      let injected: any;
      const Component: React.SFC<FastField.Bag> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          render={formikProps =>
            (injected = formikProps) && (
              <FastField name="user[superPowers][0]" component={Component} />
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
      const Component: React.SFC<FastField.Bag> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          render={formikProps =>
            (injected = formikProps) && (
              <FastField name="user.superPowers[1]" component={Component} />
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
      const Component: React.SFC<FastField.Bag> = props =>
        (actual = props) && null;

      ReactDOM.render(
        <Formik
          onSubmit={noop}
          initialValues={{ user: { superPowers: ['Surging', 'Binding'] } }}
          render={formikProps =>
            (injected = formikProps) && (
              <FastField name="user[superPowers].1" component={Component} />
            )
          }
        />,
        node
      );
      expect(actual.field.value).toBe('Binding');
    });
  });
});
