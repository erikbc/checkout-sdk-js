import { createTimeout } from '@bigcommerce/request-sender';
import { merge, map } from 'lodash';
import { Observable } from 'rxjs';
import { BillingAddressActionCreator } from '../billing';
import { CartActionCreator } from '../cart';
import { ConfigActionCreator } from '../config';
import { CountryActionCreator } from '../geography';
import { CouponActionCreator, GiftCertificateActionCreator } from '../coupon';
import { createCustomerStrategyRegistry, CustomerActionCreator } from '../customer';
import { OrderActionCreator } from '../order';
import { PaymentMethodActionCreator } from '../payment';
import { InstrumentActionCreator } from '../payment/instrument';
import { QuoteActionCreator } from '../quote';
import { createShippingStrategyRegistry, ShippingCountryActionCreator, ShippingOptionActionCreator } from '../shipping';
import { MissingDataError } from '../common/error/errors';
import { OrderFinalizationNotRequiredError } from '../order/errors';
import { getAppConfig } from '../config/configs.mock';
import { getBillingAddress, getBillingAddressResponseBody } from '../billing/billing-address.mock';
import { getCartResponseBody } from '../cart/carts.mock';
import { getCountriesResponseBody } from '../geography/countries.mock';
import { getCouponResponseBody } from '../coupon/coupon.mock';
import { getCompleteOrderResponseBody, getOrderRequestBody, getSubmittedOrder } from '../order/orders.mock';
import { getCustomerResponseBody, getGuestCustomer } from '../customer/customers.mock';
import { getFormFields } from '../form/form.mocks';
import { getGiftCertificateResponseBody } from '../coupon/gift-certificate.mock';
import { getQuoteResponseBody } from '../quote/quotes.mock';
import { getAuthorizenet, getBraintree, getPaymentMethodResponseBody, getPaymentMethodsResponseBody, getPaymentMethod } from '../payment/payment-methods.mock';
import { getInstrumentsMeta, getVaultAccessTokenResponseBody, getInstrumentsResponseBody, vaultInstrumentRequestBody, vaultInstrumentResponseBody, deleteInstrumentResponseBody } from '../payment/instrument/instrument.mock';
import { getShippingAddress, getShippingAddressResponseBody } from '../shipping/shipping-address.mock';
import { getShippingOptionResponseBody } from '../shipping/shipping-options.mock';
import { getResponse } from '../common/http-request/responses.mock';
import createCheckoutStore from './create-checkout-store';
import CheckoutService from './checkout-service';

describe('CheckoutService', () => {
    let checkoutClient;
    let checkoutService;
    let customerStrategyRegistry;
    let paymentStrategy;
    let paymentStrategyRegistry;
    let shippingStrategyRegistry;
    let store;

    beforeEach(() => {
        checkoutClient = {
            loadCart: jest.fn(() =>
                Promise.resolve(getResponse(getCartResponseBody()))
            ),

            loadConfig: jest.fn(() =>
                Promise.resolve(getResponse(getAppConfig()))
            ),

            loadCountries: jest.fn(() =>
                Promise.resolve(getResponse(getCountriesResponseBody()))
            ),

            loadOrder: jest.fn(() =>
                Promise.resolve(getResponse(getCompleteOrderResponseBody()))
            ),

            submitOrder: jest.fn(() =>
                Promise.resolve(getResponse(getCompleteOrderResponseBody()))
            ),

            finalizeOrder: jest.fn(() =>
                Promise.resolve(getResponse(getCompleteOrderResponseBody()))
            ),

            loadPaymentMethod: jest.fn(() =>
                Promise.resolve(getResponse(getPaymentMethodResponseBody()))
            ),

            loadPaymentMethods: jest.fn(() =>
                Promise.resolve(getResponse(getPaymentMethodsResponseBody()))
            ),

            loadCheckout: jest.fn(() =>
                Promise.resolve(getResponse(getQuoteResponseBody()))
            ),

            loadShippingCountries: jest.fn(() =>
                Promise.resolve(getResponse(getCountriesResponseBody()))
            ),

            signInCustomer: jest.fn(() =>
                Promise.resolve(getResponse(getCustomerResponseBody())),
            ),

            signOutCustomer: jest.fn(() =>
                Promise.resolve(getResponse(getCustomerResponseBody())),
            ),

            loadShippingOptions: jest.fn(() =>
                Promise.resolve(getResponse(getShippingOptionResponseBody())),
            ),

            updateBillingAddress: jest.fn(() =>
                Promise.resolve(getResponse(getBillingAddressResponseBody())),
            ),

            updateShippingAddress: jest.fn(() =>
                Promise.resolve(getResponse(getShippingAddressResponseBody())),
            ),

            selectShippingOption: jest.fn(() =>
                Promise.resolve(getResponse(getShippingOptionResponseBody())),
            ),

            applyCoupon: jest.fn(() =>
                Promise.resolve(getResponse(getCouponResponseBody()))
            ),

            removeCoupon: jest.fn(() =>
                Promise.resolve(getResponse(getCouponResponseBody()))
            ),

            applyGiftCertificate: jest.fn(() =>
                Promise.resolve(getResponse(getGiftCertificateResponseBody()))
            ),

            removeGiftCertificate: jest.fn(() =>
                Promise.resolve(getResponse(getGiftCertificateResponseBody()))
            ),

            getVaultAccessToken: jest.fn(() =>
                Promise.resolve(getResponse(getVaultAccessTokenResponseBody()))
            ),

            getInstruments: jest.fn(() =>
                Promise.resolve(getResponse(getInstrumentsResponseBody()))
            ),

            vaultInstrument: jest.fn(() =>
                Promise.resolve(getResponse(vaultInstrumentResponseBody()))
            ),

            deleteInstrument: jest.fn(() =>
                Promise.resolve(getResponse(deleteInstrumentResponseBody()))
            ),
        };

        store = createCheckoutStore({
            config: { data: getAppConfig() },
        });

        paymentStrategy = {
            execute: jest.fn(() => Promise.resolve(store.getState())),
            finalize: jest.fn(() => Promise.resolve(store.getState())),
            initialize: jest.fn(() => Promise.resolve(store.getState())),
            deinitialize: jest.fn(() => Promise.resolve(store.getState())),
        };

        paymentStrategyRegistry = {
            getByMethod: jest.fn(() => paymentStrategy),
        };

        shippingStrategyRegistry = createShippingStrategyRegistry(store, checkoutClient);

        customerStrategyRegistry = createCustomerStrategyRegistry(store, checkoutClient);

        checkoutService = new CheckoutService(
            store,
            customerStrategyRegistry,
            paymentStrategyRegistry,
            shippingStrategyRegistry,
            new BillingAddressActionCreator(checkoutClient),
            new CartActionCreator(checkoutClient),
            new ConfigActionCreator(checkoutClient),
            new CountryActionCreator(checkoutClient),
            new CouponActionCreator(checkoutClient),
            new CustomerActionCreator(checkoutClient),
            new GiftCertificateActionCreator(checkoutClient),
            new InstrumentActionCreator(checkoutClient),
            new OrderActionCreator(checkoutClient),
            new PaymentMethodActionCreator(checkoutClient),
            new QuoteActionCreator(checkoutClient),
            new ShippingCountryActionCreator(checkoutClient),
            new ShippingOptionActionCreator(checkoutClient)
        );
    });

    describe('#notifyState', () => {
        it('notifies subscribers of its current state', () => {
            const subscriber = jest.fn();

            checkoutService.subscribe(subscriber);
            checkoutService.notifyState();

            expect(subscriber).toHaveBeenLastCalledWith(checkoutService.getState());
            expect(subscriber).toHaveBeenCalledTimes(2);
        });
    });

    describe('#loadCheckout()', () => {
        it('loads quote data', async () => {
            const { checkout } = await checkoutService.loadCheckout();

            expect(checkoutClient.loadCheckout).toHaveBeenCalled();
            expect(checkout.getQuote()).toEqual(getQuoteResponseBody().data.quote);
        });

        it('loads config data', async () => {
            const { checkout } = await checkoutService.loadCheckout();

            expect(checkoutClient.loadConfig).toHaveBeenCalled();
            expect(checkout.getConfig()).toEqual(getAppConfig());
        });

        it('dispatches load config action with queue id', async () => {
            jest.spyOn(store, 'dispatch');

            await checkoutService.loadCheckout();

            expect(store.dispatch).toHaveBeenCalledTimes(2);
            expect(store.dispatch).toHaveBeenCalledWith(expect.any(Observable), { queueId: 'config' });
        });
    });

    describe('#loadShippingAddressFields()', () => {
        it('loads config data', async () => {
            const { checkout } = await checkoutService.loadCheckout();
            const result = checkout.getShippingAddressFields();
            const expected = getFormFields();

            expect(map(result, 'id')).toEqual(map(expected, 'id'));
        });

        it('loads extra countries data', async () => {
            const { checkout } = await checkoutService.loadShippingAddressFields();

            expect(checkout.getShippingCountries()).toEqual(getCountriesResponseBody().data);
        });
    });

    describe('#loadBillingAddressFields()', () => {
        it('loads config data', async () => {
            const { checkout } = await checkoutService.loadCheckout();
            const result = checkout.getBillingAddressFields();
            const expected = getFormFields();

            expect(map(result, 'id')).toEqual(map(expected, 'id'));
        });

        it('loads extra countries data', async () => {
            const { checkout } = await checkoutService.loadBillingAddressFields();

            expect(checkout.getBillingCountries()).toEqual(getCountriesResponseBody().data);
        });
    });

    describe('#verifyCart()', () => {
        it('verifies cart data', async () => {
            await checkoutService.loadCheckout();

            const { checkout } = await checkoutService.verifyCart();

            expect(checkout.getCheckoutMeta().isCartVerified).toEqual(true);
        });
    });

    describe('#loadOrder()', () => {
        it('loads order data', async () => {
            const { checkout } = await checkoutService.loadOrder(295);

            expect(checkout.getOrder()).toEqual(getCompleteOrderResponseBody().data.order);
        });
    });

    describe('#submitOrder()', () => {
        it('finds payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.submitOrder(getOrderRequestBody());

            expect(paymentStrategyRegistry.getByMethod).toHaveBeenCalledWith(getAuthorizenet());
        });

        it('executes payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.submitOrder(getOrderRequestBody());

            expect(paymentStrategy.execute).toHaveBeenCalledWith(getOrderRequestBody(), undefined);
        });

        it('executes payment strategy with timeout', async () => {
            const options = { timeout: createTimeout() };

            await checkoutService.loadPaymentMethods();
            await checkoutService.submitOrder(getOrderRequestBody(), options);

            expect(paymentStrategy.execute).toHaveBeenCalledWith(getOrderRequestBody(), options);
        });

        it('throws error if payment method is not found or loaded', () => {
            expect(() => checkoutService.submitOrder(getOrderRequestBody())).toThrow(MissingDataError);
        });
    });

    describe('#finalizeOrderIfNeeded()', () => {
        beforeEach(() => {
            jest.spyOn(checkoutClient, 'loadCheckout').mockReturnValue(
                Promise.resolve(getResponse(merge({}, getQuoteResponseBody(), {
                    data: { order: getSubmittedOrder() },
                })))
            );
        });

        it('finds payment strategy', async () => {
            await checkoutService.loadCheckout();
            await checkoutService.loadPaymentMethods();
            await checkoutService.finalizeOrderIfNeeded();

            expect(paymentStrategyRegistry.getByMethod).toHaveBeenCalledWith(getAuthorizenet());
        });

        it('finalizes order', async () => {
            await checkoutService.loadCheckout();
            await checkoutService.loadPaymentMethods();
            await checkoutService.finalizeOrderIfNeeded();

            expect(paymentStrategy.finalize).toHaveBeenCalledWith(undefined);
        });

        it('finalizes order with timeout', async () => {
            const options = { timeout: createTimeout() };

            await checkoutService.loadCheckout();
            await checkoutService.loadPaymentMethods();
            await checkoutService.finalizeOrderIfNeeded(options);

            expect(paymentStrategy.finalize).toHaveBeenCalledWith(options);
        });

        it('throws error if payment data is not available', async () => {
            await checkoutService.loadCheckout();

            expect(() => checkoutService.finalizeOrderIfNeeded()).toThrow();
        });

        it('throws error if checkout data is not available', () => {
            expect(() => checkoutService.finalizeOrderIfNeeded()).toThrow();
        });

        it('returns rejected promise if order does not require finalization', async () => {
            jest.spyOn(checkoutClient, 'loadCheckout').mockReturnValue(
                Promise.resolve(getResponse(merge({}, getQuoteResponseBody(), {
                    data: { order: { ...getSubmittedOrder(), payment: null } },
                })))
            );

            await checkoutService.loadCheckout();
            await checkoutService.loadPaymentMethods();

            try {
                await checkoutService.finalizeOrderIfNeeded();
            } catch (error) {
                expect(error).toBeInstanceOf(OrderFinalizationNotRequiredError);
            }
        });
    });

    describe('#loadPaymentMethods()', () => {
        it('loads payment methods', async () => {
            await checkoutService.loadPaymentMethods();

            expect(checkoutClient.loadPaymentMethods).toHaveBeenCalledWith(undefined);
        });

        it('loads payment methods with timeout', async () => {
            const options = { timeout: createTimeout() };

            await checkoutService.loadPaymentMethods(options);

            expect(checkoutClient.loadPaymentMethods).toHaveBeenCalledWith(options);
        });

        it('returns payment methods', async () => {
            const { checkout } = await checkoutService.loadPaymentMethods();

            expect(checkout.getPaymentMethods()).toEqual(getPaymentMethodsResponseBody().data.paymentMethods);
        });

        it('dispatches action with queue id', async () => {
            jest.spyOn(store, 'dispatch');

            await checkoutService.loadPaymentMethods();

            expect(store.dispatch).toHaveBeenCalledWith(expect.any(Observable), { queueId: 'paymentMethods' });
        });
    });

    describe('#loadPaymentMethod()', () => {
        it('loads payment method', async () => {
            await checkoutService.loadPaymentMethod('authorizenet');

            expect(checkoutClient.loadPaymentMethod).toHaveBeenCalledWith('authorizenet', undefined);
        });

        it('loads payment method with timeout', async () => {
            const options = { timeout: createTimeout() };

            await checkoutService.loadPaymentMethod('authorizenet', options);

            expect(checkoutClient.loadPaymentMethod).toHaveBeenCalledWith('authorizenet', options);
        });

        it('returns payment method', async () => {
            const { checkout } = await checkoutService.loadPaymentMethod('authorizenet');

            expect(checkout.getPaymentMethod('authorizenet')).toEqual(getPaymentMethodResponseBody().data.paymentMethod);
        });

        it('dispatches action with queue id', async () => {
            jest.spyOn(store, 'dispatch');

            await checkoutService.loadPaymentMethod('authorizenet');

            expect(store.dispatch).toHaveBeenCalledWith(expect.any(Observable), { queueId: 'paymentMethods' });
        });
    });

    describe('#initializePaymentMethod()', () => {
        it('finds payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.initializePaymentMethod('braintree');

            expect(paymentStrategyRegistry.getByMethod).toHaveBeenCalledWith(getBraintree());
        });

        it('initializes payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.initializePaymentMethod('braintree');

            expect(paymentStrategy.initialize).toHaveBeenCalledWith({
                paymentMethod: getBraintree(),
            });
        });

        it('throws error if payment method has not been loaded', () => {
            expect(() => checkoutService.initializePaymentMethod('braintree')).toThrow(MissingDataError);
        });
    });

    describe('#deinitializePaymentMethod()', () => {
        it('finds payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.deinitializePaymentMethod('braintree');

            expect(paymentStrategyRegistry.getByMethod).toHaveBeenCalledWith(getBraintree());
        });

        it('deinitializes payment strategy', async () => {
            await checkoutService.loadPaymentMethods();
            await checkoutService.deinitializePaymentMethod('braintree');

            expect(paymentStrategy.deinitialize).toHaveBeenCalled();
        });

        it('throws error if payment method has not been loaded', () => {
            expect(() => checkoutService.deinitializePaymentMethod('braintree')).toThrow(MissingDataError);
        });
    });

    describe('#loadBillingCountries()', () => {
        it('loads billing countries data', async () => {
            const { checkout } = await checkoutService.loadBillingCountries();

            expect(checkout.getBillingCountries()).toEqual(getCountriesResponseBody().data);
        });

        it('dispatches action with queue id', async () => {
            jest.spyOn(store, 'dispatch');

            await checkoutService.loadBillingCountries();

            expect(store.dispatch).toHaveBeenCalledWith(expect.any(Observable), { queueId: 'billingCountries' });
        });
    });

    describe('#loadShippingCountries()', () => {
        it('loads shipping countries data', async () => {
            const { checkout } = await checkoutService.loadShippingCountries();

            expect(checkout.getShippingCountries()).toEqual(getCountriesResponseBody().data);
        });

        it('dispatches action with queue id', async () => {
            jest.spyOn(store, 'dispatch');

            await checkoutService.loadShippingCountries();

            expect(store.dispatch).toHaveBeenCalledWith(expect.any(Observable), { queueId: 'shippingCountries' });
        });
    });

    describe('#initializeCustomer()', () => {
        it('finds customer strategy by id', async () => {
            const options = { methodId: getPaymentMethod().id };

            jest.spyOn(customerStrategyRegistry, 'get');

            await checkoutService.initializeCustomer(options);

            expect(customerStrategyRegistry.get).toHaveBeenCalledWith(options.methodId);
        });

        it('initializes remote customer strategy with remote payment method', async () => {
            const paymentMethod = getPaymentMethod();
            const strategy = customerStrategyRegistry.get(paymentMethod.id);

            jest.spyOn(strategy, 'initialize');
            jest.spyOn(checkoutClient, 'loadPaymentMethod')
                .mockReturnValue(Promise.resolve(getResponse(getPaymentMethodResponseBody())));

            await checkoutService.initializeCustomer({ methodId: paymentMethod.id });

            expect(checkoutClient.loadPaymentMethod).toHaveBeenCalledWith(paymentMethod.id, undefined);
            expect(strategy.initialize).toHaveBeenCalledWith(expect.objectContaining({ paymentMethod }));
        });

        it('initializes default shipping strategy if remote payment is not enabled', async () => {
            const strategy = customerStrategyRegistry.get('default');
            const options = {};

            jest.spyOn(strategy, 'initialize');

            await checkoutService.initializeCustomer(options);

            expect(strategy.initialize).toHaveBeenCalledWith(options);
        });

        it('returns current state', async () => {
            const output = await checkoutService.initializeCustomer();

            expect(output).toEqual(store.getState());
        });
    });

    describe('#deinitializeCustomer()', () => {
        it('finds and uses customer strategy by id', async () => {
            const methodId = 'amazon';
            const strategy = customerStrategyRegistry.get(methodId);

            jest.spyOn(customerStrategyRegistry, 'get');
            jest.spyOn(strategy, 'deinitialize');

            await checkoutService.deinitializeCustomer({ methodId });

            expect(customerStrategyRegistry.get).toHaveBeenCalledWith(methodId);
            expect(strategy.deinitialize).toHaveBeenCalled();
        });

        it('uses default customer strategy by default', async () => {
            const strategy = customerStrategyRegistry.get('default');

            jest.spyOn(strategy, 'deinitialize');

            await checkoutService.deinitializeCustomer();

            expect(strategy.deinitialize).toHaveBeenCalled();
        });

        it('returns current state', async () => {
            const output = await checkoutService.deinitializeCustomer();

            expect(output).toEqual(store.getState());
        });
    });

    describe('#signInCustomer()', () => {
        it('finds customer strategy by id', async () => {
            const credentials = { email: 'foo@bar.com', password: 'foobar' };
            const options = { methodId: getPaymentMethod().id };

            jest.spyOn(customerStrategyRegistry, 'get');

            await checkoutService.signInCustomer(credentials, options);

            expect(customerStrategyRegistry.get).toHaveBeenCalledWith(options.methodId);
        });

        it('uses default customer strategy by default', async () => {
            const strategy = customerStrategyRegistry.get('default');
            const credentials = { email: 'foo@bar.com', password: 'foobar' };
            const options = {};

            jest.spyOn(strategy, 'signIn');

            await checkoutService.signInCustomer(credentials, options);

            expect(strategy.signIn).toHaveBeenCalledWith(credentials, options);
        });

        it('signs in customer', async () => {
            const credentials = { email: 'foo@bar.com', password: 'foobar' };
            const { checkout } = await checkoutService.signInCustomer(credentials);

            expect(checkout.getCustomer()).toEqual(getCustomerResponseBody().data.customer);
        });
    });

    describe('#signOutCustomer()', () => {
        it('finds customer strategy by id', async () => {
            const options = { methodId: getPaymentMethod().id };

            jest.spyOn(customerStrategyRegistry, 'get');

            await checkoutService.signOutCustomer(options);

            expect(customerStrategyRegistry.get).toHaveBeenCalledWith(options.methodId);
        });

        it('uses default customer strategy by default', async () => {
            const strategy = customerStrategyRegistry.get('default');
            const options = {};

            jest.spyOn(strategy, 'signOut');

            await checkoutService.signOutCustomer(options);

            expect(strategy.signOut).toHaveBeenCalledWith(options);
        });

        it('signs in customer', async () => {
            const { checkout } = await checkoutService.signOutCustomer();

            expect(checkout.getCustomer()).toEqual(getCustomerResponseBody().data.customer);
        });
    });

    describe('#loadShippingOptions()', () => {
        it('loads shipping options', async () => {
            const { checkout } = await checkoutService.loadShippingOptions();

            expect(checkout.getShippingOptions()).toEqual(getShippingOptionResponseBody().data.shippingOptions);
        });
    });

    describe('#initializeShipping()', () => {
        let customer;
        let remoteCustomer;
        let paymentMethod;
        let state;

        beforeEach(() => {
            customer = getGuestCustomer();
            paymentMethod = getPaymentMethod();
            remoteCustomer = { ...getGuestCustomer(), remote: { provider: paymentMethod.id } };
            state = {
                checkout: {
                    getCustomer: () => customer,
                    getPaymentMethod: () => paymentMethod,
                },
            };

            jest.spyOn(shippingStrategyRegistry, 'get');

            jest.spyOn(store, 'getState')
                .mockReturnValue(state);

            jest.spyOn(checkoutClient, 'loadPaymentMethod')
                .mockReturnValue(Promise.resolve(getResponse(getPaymentMethodResponseBody())));
        });

        it('finds shipping strategy', async () => {
            jest.spyOn(state.checkout, 'getCustomer')
                .mockReturnValue(remoteCustomer);

            await checkoutService.initializeShipping();

            expect(shippingStrategyRegistry.get).toHaveBeenCalledWith(remoteCustomer.remote.provider);
        });

        it('initializes remote shipping strategy with remote payment method', async () => {
            const strategy = shippingStrategyRegistry.get(remoteCustomer.remote.provider);

            jest.spyOn(strategy, 'initialize');

            jest.spyOn(state.checkout, 'getCustomer')
                .mockReturnValue(remoteCustomer);

            await checkoutService.initializeShipping();

            expect(checkoutClient.loadPaymentMethod).toHaveBeenCalledWith(remoteCustomer.remote.provider, undefined);
            expect(strategy.initialize).toHaveBeenCalledWith({ paymentMethod });
        });

        it('initializes default shipping strategy if remote payment is not enabled', async () => {
            const strategy = shippingStrategyRegistry.get();
            const options = {};

            jest.spyOn(strategy, 'initialize');

            await checkoutService.initializeShipping(options);

            expect(strategy.initialize).toHaveBeenCalledWith(options);
        });

        it('returns current state', async () => {
            const output = await checkoutService.initializeShipping();

            expect(output).toEqual(store.getState());
        });
    });

    describe('#deinitializeShipping()', () => {
        let customer;

        beforeEach(() => {
            customer = { ...getGuestCustomer(), remote: { provider: getPaymentMethod().id } };

            jest.spyOn(shippingStrategyRegistry, 'get');

            jest.spyOn(store, 'getState')
                .mockReturnValue({
                    checkout: {
                        getCustomer: () => customer,
                    },
                });
        });

        it('finds shipping strategy', async () => {
            await checkoutService.deinitializeShipping();

            expect(shippingStrategyRegistry.get).toHaveBeenCalledWith(customer.remote.provider);
        });

        it('deinitializes shipping strategy', async () => {
            const strategy = shippingStrategyRegistry.get(customer.remote.provider);

            jest.spyOn(strategy, 'deinitialize');

            await checkoutService.deinitializeShipping();

            expect(strategy.deinitialize).toHaveBeenCalled();
        });

        it('returns current state', async () => {
            const output = await checkoutService.deinitializeShipping();

            expect(output).toEqual(store.getState());
        });
    });

    describe('#selectShippingOption()', () => {
        it('selects a shipping option', async () => {
            const addressId = 'addresd-id-123';
            const shippingOptionId = 'shipping-option-id-456';
            const options = { timeout: createTimeout() };
            await checkoutService.selectShippingOption(addressId, shippingOptionId, options);

            expect(checkoutClient.selectShippingOption)
                .toHaveBeenCalledWith(addressId, shippingOptionId, options);
        });
    });

    describe('#updateShippingAddress()', () => {
        it('updates the shipping address', async () => {
            const address = getShippingAddress();
            const options = { timeout: createTimeout() };
            await checkoutService.updateShippingAddress(address, options);

            expect(checkoutClient.updateShippingAddress)
                .toHaveBeenCalledWith(address, options);
        });
    });

    describe('#updateBillingAddress()', () => {
        it('updates the billing address', async () => {
            const address = getBillingAddress();
            const options = { timeout: createTimeout() };
            await checkoutService.updateBillingAddress(address, options);

            expect(checkoutClient.updateBillingAddress)
                .toHaveBeenCalledWith(address, options);
        });
    });

    describe('#applyCoupon()', () => {
        it('applies a coupon', async () => {
            const code = 'myCoupon1234';
            const options = { timeout: createTimeout() };
            await checkoutService.applyCoupon(code, options);

            expect(checkoutClient.applyCoupon)
                .toHaveBeenCalledWith(code, options);
        });
    });

    describe('#removeCoupon()', () => {
        it('removes a coupon', async () => {
            const code = 'myCoupon1234';
            const options = { timeout: createTimeout() };
            await checkoutService.removeCoupon(code, options);

            expect(checkoutClient.removeCoupon)
                .toHaveBeenCalledWith(code, options);
        });
    });

    describe('#applyGiftCertificate()', () => {
        it('applies a gift certificate', async () => {
            const code = 'myGiftCertificate1234';
            const options = { timeout: createTimeout() };
            await checkoutService.applyGiftCertificate(code, options);

            expect(checkoutClient.applyGiftCertificate)
                .toHaveBeenCalledWith(code, options);
        });
    });

    describe('#removeGiftCertificate()', () => {
        it('removes a gift certificate', async () => {
            const code = 'myGiftCertificate1234';
            const options = { timeout: createTimeout() };
            await checkoutService.removeGiftCertificate(code, options);

            expect(checkoutClient.removeGiftCertificate)
                .toHaveBeenCalledWith(code, options);
        });
    });

    describe('#loadInstruments()', () => {
        it('loads instruments', async () => {
            const { storeId } = getAppConfig();
            const { customerId } = getGuestCustomer();
            const { vaultAccessToken } = getInstrumentsMeta();

            await checkoutService.signInCustomer();
            await checkoutService.loadInstruments();

            expect(checkoutClient.getInstruments)
                .toHaveBeenCalledWith(storeId, customerId, vaultAccessToken);
        });

        it('throws error if customer data is missing', () => {
            expect(() => checkoutService.loadInstruments()).toThrow(MissingDataError);
        });
    });

    describe('#vaultInstrument()', () => {
        it('vaults an instrument', async () => {
            const { storeId } = getAppConfig();
            const { customerId } = getGuestCustomer();
            const { vaultAccessToken } = getInstrumentsMeta();
            const instrument = vaultInstrumentRequestBody();

            await checkoutService.signInCustomer();
            await checkoutService.vaultInstrument(instrument);

            expect(checkoutClient.vaultInstrument)
                .toHaveBeenCalledWith(storeId, customerId, vaultAccessToken, instrument);
        });

        it('throws error if customer data is missing', () => {
            const instrument = vaultInstrumentRequestBody();

            expect(() => checkoutService.vaultInstrument(instrument)).toThrow(MissingDataError);
        });
    });

    describe('#deleteInstrument()', () => {
        it('deletes an instrument', async () => {
            const { storeId } = getAppConfig();
            const { customerId } = getGuestCustomer();
            const { vaultAccessToken } = getInstrumentsMeta();
            const instrumentId = '456';

            await checkoutService.signInCustomer();
            await checkoutService.deleteInstrument(instrumentId);

            expect(checkoutClient.deleteInstrument)
                .toHaveBeenCalledWith(storeId, customerId, vaultAccessToken, instrumentId);
        });

        it('throws error if customer data is missing', () => {
            expect(() => checkoutService.deleteInstrument(456)).toThrow(MissingDataError);
        });
    });
});