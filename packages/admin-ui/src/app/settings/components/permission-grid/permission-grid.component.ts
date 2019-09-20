import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { Permission } from '../../../common/generated-types';
import { _ } from '../../../core/providers/i18n/mark-for-extraction';

/**
 * A table showing and allowing the setting of all possible CRUD permissions.
 */
@Component({
    selector: 'vdr-permission-grid',
    templateUrl: './permission-grid.component.html',
    styleUrls: ['./permission-grid.component.scss'],
    changeDetection: ChangeDetectionStrategy.Default,
})
export class PermissionGridComponent {
    @Input() permissions: { [K in Permission]: boolean } = {} as any;
    @Input() readonly = false;
    @Output() permissionChange = new EventEmitter<{ permission: string; value: boolean }>();
    readonly gridData = [
        {
            label: _('settings.catalog'),
            permissions: ['CreateCatalog', 'ReadCatalog', 'UpdateCatalog', 'DeleteCatalog'],
        },
        {
            label: _('settings.customer'),
            permissions: ['CreateCustomer', 'ReadCustomer', 'UpdateCustomer', 'DeleteCustomer'],
        },
        {
            label: _('settings.order'),
            permissions: ['CreateOrder', 'ReadOrder', 'UpdateOrder', 'DeleteOrder'],
        },
        {
            label: _('settings.promotion'),
            permissions: ['CreatePromotion', 'ReadPromotion', 'UpdatePromotion', 'DeletePromotion'],
        },
        {
            label: _('settings.administrator'),
            permissions: [
                'CreateAdministrator',
                'ReadAdministrator',
                'UpdateAdministrator',
                'DeleteAdministrator',
            ],
        },
        {
            label: _('settings.settings'),
            permissions: ['CreateSettings', 'ReadSettings', 'UpdateSettings', 'DeleteSettings'],
        },
    ];

    setPermission(permission: string, value: boolean) {
        this.permissionChange.emit({ permission, value });
    }
}
