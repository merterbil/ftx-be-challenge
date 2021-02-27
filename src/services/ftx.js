import { Service, Container } from 'typedi';

@Service()
export default class FtxService {
  _ftx = Container.get('ftx');

  _getMarketNames = async (baseCurrency, quoteCurrency) => {
    const market = [baseCurrency, quoteCurrency];
    const markets = await this._ftx.request({
      method: 'GET',
      path: `/markets`,
    });
    return (
      markets?.result
        ?.filter((item) => item.type === 'spot' && (item.name === market.join('/') || item.name === market.reverse().join('/')))
        .map((item) => item.name) || []
    );
  };

  _getOrderbook = async (market) => {
    const orderbook = await this._ftx.request({
      method: 'GET',
      path: `/markets/${market}/orderbook`,
    });
    return orderbook?.result || {};
  };

  quote = async ({ action, base_currency, quote_currency, amount }) => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      throw new Error('amount cannot parsed')
    }

    const markets = await this._getMarketNames(base_currency, quote_currency);
    if (!markets.length) {
      throw new Error('No market for requested currencies');
    }

    const orderbooks = await Promise.all(
      markets.map(async (item) => {
        const orderbook = await this._getOrderbook(item);
        return {
          market: item,
          book: (action === 'buy' ? orderbook.bids : orderbook.asks) || [],
        };
      })
    );

    let total = 0;
    orderbooks.forEach((item) => {
      let _amount = parsedAmount;
      item.book.forEach(([unitPrice, size]) => {
        if (_amount === 0) {
          return;
        }

        if (_amount > size) {
          total += size * unitPrice;
          _amount -= size;
        } else {
          total += _amount * unitPrice;
          _amount = 0;
        }
      });
    });

    return {
      total: total.toFixed(8),
      price: (total / amount).toFixed(8),
      currency: quote_currency,
    };
  };
}
