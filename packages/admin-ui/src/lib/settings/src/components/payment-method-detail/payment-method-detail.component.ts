import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import {
    BaseDetailComponent,
    ConfigArgDefinition,
    DataService,
    encodeConfigArgValue,
    getConfigArgValue,
    NotificationService,
    PaymentMethod,
    ServerConfigService,
    UpdatePaymentMethodInput,
} from '@vendure/admin-ui/core';
import { mergeMap, take } from 'rxjs/operators';

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
        protected dataService: DataService,
        private formBuilder: FormBuilder,
        private notificationService: NotificationService,
    ) {
        super(route, router, serverConfigService, dataService);
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

    getArgDef(paymentMethod: PaymentMethod.Fragment, argName: string): ConfigArgDefinition | undefined {
        return paymentMethod.definition.args.find(a => a.name === argName);
    }

    configArgsIsPopulated(): boolean {
        const configArgsGroup = this.detailForm.get('configArgs') as FormGroup | undefined;
        if (!configArgsGroup) {
            return false;
        }
        return 0 < Object.keys(configArgsGroup.controls).length;
    }

    save() {
        this.entity$
            .pipe(
                take(1),
                mergeMap(({ id, configArgs }) => {
                    const formValue = this.detailForm.value;
                    const input: UpdatePaymentMethodInput = {
                        id,
                        code: formValue.code,
                        enabled: formValue.enabled,
                        configArgs: Object.entries<any>(formValue.configArgs).map(([name, value], i) => ({
                            name,
                            value: encodeConfigArgValue(value),
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
                let control = configArgsGroup.get(arg.name);
                const def = this.getArgDef(paymentMethod, arg.name);
                const value = def?.list === true && arg.value === '' ? [] : getConfigArgValue(arg.value);
                if (control) {
                    control.patchValue(value);
                } else {
                    control = this.formBuilder.control(value);
                    configArgsGroup.addControl(arg.name, control);
                }
            }
        }
        this.changeDetector.markForCheck();
    }
}
