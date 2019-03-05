import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mergeMap, take } from 'rxjs/operators';
import {
    ConfigArg,
    ConfigurableOperation,
    ConfigurableOperationInput,
    PaymentMethod,
    UpdatePaymentMethodInput,
} from 'shared/generated-types';

import { BaseDetailComponent } from '../../../common/base-detail.component';
import { _ } from '../../../core/providers/i18n/mark-for-extraction';
import { NotificationService } from '../../../core/providers/notification/notification.service';
import { DataService } from '../../../data/providers/data.service';
import { ServerConfigService } from '../../../data/server-config';

@Component({
    selector: 'vdr-payment-method-detail',
    templateUrl: './payment-method-detail.component.html',
    styleUrls: ['./payment-method-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodDetailComponent extends BaseDetailComponent<PaymentMethod.Fragment>
    implements OnInit, OnDestroy {
    detailForm: FormGroup;

    constructor(
        router: Router,
        route: ActivatedRoute,
        serverConfigService: ServerConfigService,
        private changeDetector: ChangeDetectorRef,
        private dataService: DataService,
        private formBuilder: FormBuilder,
        private notificationService: NotificationService,
    ) {
        super(route, router, serverConfigService);
        this.detailForm = this.formBuilder.group({
            code: ['', Validators.required],
            enabled: [true, Validators.required],
            configArgs: this.formBuilder.group({}),
        });
    }

    ngOnInit() {
        this.init();
    }

    ngOnDestroy(): void {
        this.destroy();
    }

    save() {
        this.entity$
            .pipe(
                take(1),
                mergeMap(({ id }) => {
                    const formValue = this.detailForm.value;
                    const input: UpdatePaymentMethodInput = {
                        id,
                        code: formValue.code,
                        enabled: formValue.enabled,
                        configArgs: Object.entries(formValue.configArgs).map(([name, value]) => ({
                            name,
                            value: value.toString(),
                        })),
                    };
                    return this.dataService.settings.updatePaymentMethod(input);
                }),
            )
            .subscribe(
                data => {
                    this.notificationService.success(_('common.notify-update-success'), {
                        entity: 'PaymentMethod',
                    });
                    this.detailForm.markAsPristine();
                    this.changeDetector.markForCheck();
                },
                err => {
                    this.notificationService.error(_('common.notify-update-error'), {
                        entity: 'PaymentMethod',
                    });
                },
            );
    }

    protected setFormValues(paymentMethod: PaymentMethod.Fragment): void {
        this.detailForm.patchValue({
            code: paymentMethod.code,
            enabled: paymentMethod.enabled,
        });
        const configArgsGroup = this.detailForm.get('configArgs') as FormGroup;
        if (configArgsGroup) {
            for (const arg of paymentMethod.configArgs) {
                const control = configArgsGroup.get(arg.name);
                if (control) {
                    control.patchValue(this.parseArgValue(arg));
                } else {
                    configArgsGroup.addControl(arg.name, this.formBuilder.control(this.parseArgValue(arg)));
                }
            }
        }
    }

    private parseArgValue(arg: ConfigArg): string | number | boolean {
        switch (arg.type) {
            case 'int':
                return Number.parseInt(arg.value || '0', 10);
            case 'boolean':
                return arg.value === 'false' ? false : true;
            default:
                return arg.value || '';
        }
    }
}
