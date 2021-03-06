import { createAction, ThunkAction } from '@bigcommerce/data-store';
import { concat } from 'rxjs/observable/concat';
import { from } from 'rxjs/observable/from';
import { of } from 'rxjs/observable/of';
import { catchError, switchMap } from 'rxjs/operators';

import { CheckoutActionCreator, InternalCheckoutSelectors } from '../checkout';
import { throwErrorAction } from '../common/error';
import { RequestOptions } from '../common/http-request';

import { CustomerActionType, SignInCustomerAction, SignOutCustomerAction } from './customer-actions';
import CustomerCredentials from './customer-credentials';
import CustomerRequestSender from './customer-request-sender';

export default class CustomerActionCreator {
    constructor(
        private _customerRequestSender: CustomerRequestSender,
        private _checkoutActionCreator: CheckoutActionCreator
    ) {}

    signInCustomer(
        credentials: CustomerCredentials,
        options?: RequestOptions
    ): ThunkAction<SignInCustomerAction, InternalCheckoutSelectors> {
        return store => concat(
            of(createAction(CustomerActionType.SignInCustomerRequested)),
            from(this._customerRequestSender.signInCustomer(credentials, options))
                .pipe(
                    switchMap(({ body }) => concat(
                        this._checkoutActionCreator.loadCurrentCheckout(options)(store),
                        of(createAction(CustomerActionType.SignInCustomerSucceeded, body.data))
                    ))
                )
        ).pipe(
            catchError(error => throwErrorAction(CustomerActionType.SignInCustomerFailed, error))
        );
    }

    signOutCustomer(
        options?: RequestOptions
    ): ThunkAction<SignOutCustomerAction, InternalCheckoutSelectors> {
        return store => concat(
            of(createAction(CustomerActionType.SignOutCustomerRequested)),
            from(this._customerRequestSender.signOutCustomer(options))
                .pipe(
                    switchMap(({ body }) => concat(
                        this._checkoutActionCreator.loadCurrentCheckout(options)(store),
                        of(createAction(CustomerActionType.SignOutCustomerSucceeded, body.data))
                    ))
                )
        ).pipe(
            catchError(error => throwErrorAction(CustomerActionType.SignOutCustomerFailed, error))
        );
    }
}
