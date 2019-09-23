import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { _ } from '@vendure/admin-ui/src/app/core/providers/i18n/mark-for-extraction';
import { NotificationService } from '@vendure/admin-ui/src/app/core/providers/notification/notification.service';
import { ModalService } from '@vendure/admin-ui/src/app/shared/providers/modal/modal.service';
import { EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { BaseListComponent } from '../../../common/base-list.component';
import { GetPromotionList } from '../../../common/generated-types';
import { DataService } from '../../../data/providers/data.service';

@Component({
    selector: 'vdr-promotion-list',
    templateUrl: './promotion-list.component.html',
    styleUrls: ['./promotion-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromotionListComponent extends BaseListComponent<
    GetPromotionList.Query,
    GetPromotionList.Items
> {
    constructor(
        private dataService: DataService,
        router: Router,
        route: ActivatedRoute,
        private notificationService: NotificationService,
        private modalService: ModalService,
    ) {
        super(router, route);
        super.setQueryFn(
            (...args: any[]) => this.dataService.promotion.getPromotions(...args),
            data => data.promotions,
        );
    }

    deletePromotion(promotionId: string) {
        this.modalService
            .dialog({
                title: _('catalog.confirm-delete-promotion'),
                buttons: [
                    { type: 'seconday', label: _('common.cancel') },
                    { type: 'danger', label: _('common.delete'), returnValue: true },
                ],
            })
            .pipe(
                switchMap(response =>
                    response ? this.dataService.promotion.deletePromotion(promotionId) : EMPTY,
                ),
            )
            .subscribe(
                () => {
                    this.notificationService.success(_('common.notify-delete-success'), {
                        entity: 'Promotion',
                    });
                    this.refresh();
                },
                err => {
                    this.notificationService.error(_('common.notify-delete-error'), {
                        entity: 'Promotion',
                    });
                },
            );
    }
}
