import ReactDOMServer from 'react-dom/server';
import { RouterContext, match } from 'react-router';
import { trigger } from 'redial';
import { Provider } from 'react-redux';
import IntlProvider from 'app/composition/IntlProvider';
import { makeHtml } from 'server/utils';

const log = debug('render-react-app');

const getRouteContext = (ctx, routes) => (
  new Promise((resolve, reject) => {
    match({
      routes, location: ctx.request.url,
    }, async (error, redirect, renderProps) => {
      if (error) {
        ctx.status = 500;
        reject(ctx.throw(error));
      } else if (redirect) {
        ctx.status = 302;
        reject(ctx.redirect(`${redirect.pathname}${redirect.search}`));
      } else if (!renderProps) {
        ctx.status = 404;
        reject();
      } else {
        await trigger('prefetch', renderProps.components, {
          dispatch: ctx.store.dispatch,
          location: renderProps.location,
          params: renderProps.params,
        });
        resolve(<RouterContext {...renderProps} />);
      }
    });
  })
);

export default function(routes, assets) {
  return async function renderReactApp(ctx) {
    try {
      const routeContext = await getRouteContext(ctx, routes);

      const intlSelector = state => state.get('intl').toJS();
      const contentArray = [
        {
          id: 'app-container',
          dangerouslySetInnerHTML: {
            __html: ReactDOMServer.renderToString(
              <Provider store={ctx.store}>
                <IntlProvider intlSelector={intlSelector}>
                  {routeContext}
                </IntlProvider>
              </Provider>
            ),
          },
        },
      ];

      log('rendering react app');
      ctx.response.body = makeHtml(ctx.store.getState(), assets, contentArray);
    } catch (error) {
      log(error);
      if (error instanceof Error) throw error;
    }
  };
}
