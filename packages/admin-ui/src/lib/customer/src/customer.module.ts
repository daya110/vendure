import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '@vendure/admin-ui/core';

import { AddCustomerToGroupDialogComponent } from './components/add-customer-to-group-dialog/add-customer-to-group-dialog.component';
import { AddressCardComponent } from './components/address-card/address-card.component';
import { AddressDetailDialogComponent } from './components/address-detail-dialog/address-detail-dialog.component';
import { CustomerDetailComponent } from './components/customer-detail/customer-detail.component';
import { CustomerGroupDetailDialogComponent } from './components/customer-group-detail-dialog/customer-group-detail-dialog.component';
import { CustomerGroupListComponent } from './components/customer-group-list/customer-group-list.component';
import { CustomerGroupMemberListComponent } from './components/customer-group-member-list/customer-group-member-list.component';
import { CustomerHistoryComponent } from './components/customer-history/customer-history.component';
import { CustomerListComponent } from './components/customer-list/customer-list.component';
import { CustomerStatusLabelComponent } from './components/customer-status-label/customer-status-label.component';
import { SelectCustomerGroupDialogComponent } from './components/select-customer-group-dialog/select-customer-group-dialog.component';
import { customerRoutes } from './customer.routes';

@NgModule({
    imports: [SharedModule, RouterModule.forChild(customerRoutes)],
    declarations: [
        CustomerListComponent,
        CustomerDetailComponent,
        CustomerStatusLabelComponent,
        AddressCardComponent,
        CustomerGroupListComponent,
        CustomerGroupDetailDialogComponent,
        AddCustomerToGroupDialogComponent,
        CustomerGroupMemberListComponent,
        SelectCustomerGroupDialogComponent,
        CustomerHistoryComponent,
        AddressDetailDialogComponent,
    ],
    exports: [AddressCardComponent],
})
export class CustomerModule {}
