import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { mergeMap, take } from 'rxjs/operators';
import {
    ConfigurableOperation,
    CreateTaxCategoryInput,
    LanguageCode,
    TaxCategory,
    UpdateTaxCategoryInput,
} from 'shared/generated-types';

import { BaseDetailComponent } from '../../../common/base-detail.component';
import { _ } from '../../../core/providers/i18n/mark-for-extraction';
import { NotificationService } from '../../../core/providers/notification/notification.service';
import { DataService } from '../../../data/providers/data.service';
import { ServerConfigService } from '../../../data/server-config';

@Component({
    selector: 'vdr-tax-detail',
    templateUrl: './tax-category-detail.component.html',
    styleUrls: ['./tax-category-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxCategoryDetailComponent extends BaseDetailComponent<TaxCategory.Fragment>
    implements OnInit, OnDestroy {
    taxCategory$: Observable<TaxCategory.Fragment>;
    detailForm: FormGroup;

    private taxCondition: ConfigurableOperation;
    private taxAction: ConfigurableOperation;

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
            name: ['', Validators.required],
            taxRate: [0, Validators.required],
        });
    }

    ngOnInit() {
        this.init();
        this.taxCategory$ = this.entity$;
    }

    ngOnDestroy() {
        this.destroy();
    }

    saveButtonEnabled(): boolean {
        return this.detailForm.dirty && this.detailForm.valid;
    }

    create() {
        if (!this.detailForm.dirty) {
            return;
        }
        const formValue = this.detailForm.value;
        const input = { name: formValue.name } as CreateTaxCategoryInput;
        this.dataService.settings.createTaxCategory(input).subscribe(
            data => {
                this.notificationService.success(_('common.notify-create-success'), {
                    entity: 'TaxCategory',
                });
                this.detailForm.markAsPristine();
                this.changeDetector.markForCheck();
                this.router.navigate(['../', data.createTaxCategory.id], { relativeTo: this.route });
            },
            err => {
                this.notificationService.error(_('common.notify-create-error'), {
                    entity: 'TaxCategory',
                });
            },
        );
    }

    save() {
        if (!this.detailForm.dirty) {
            return;
        }
        const formValue = this.detailForm.value;
        this.taxCategory$
            .pipe(
                take(1),
                mergeMap(taxCategory => {
                    const input = {
                        id: taxCategory.id,
                        name: formValue.name,
                    } as UpdateTaxCategoryInput;
                    return this.dataService.settings.updateTaxCategory(input);
                }),
            )
            .subscribe(
                data => {
                    this.notificationService.success(_('common.notify-update-success'), {
                        entity: 'TaxCategory',
                    });
                    this.detailForm.markAsPristine();
                    this.changeDetector.markForCheck();
                },
                err => {
                    this.notificationService.error(_('common.notify-update-error'), {
                        entity: 'TaxCategory',
                    });
                },
            );
    }

    /**
     * Update the form values when the entity changes.
     */
    protected setFormValues(entity: TaxCategory.Fragment, languageCode: LanguageCode): void {
        this.detailForm.patchValue({
            name: entity.name,
        });
    }
}
