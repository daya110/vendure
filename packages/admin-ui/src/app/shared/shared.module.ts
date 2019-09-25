import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClarityModule } from '@clr/angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { NgxPaginationModule } from 'ngx-pagination';

import { ActionBarItemsComponent } from './components/action-bar-items/action-bar-items.component';
import {
    ActionBarComponent,
    ActionBarLeftComponent,
    ActionBarRightComponent,
} from './components/action-bar/action-bar.component';
import { DisabledDirective } from './directives/disabled.directive';
import { IfPermissionsDirective } from './directives/if-permissions.directive';
import { HasPermissionPipe } from './pipes/has-permission.pipe';
import { ModalService } from './providers/modal/modal.service';
import { CanDeactivateDetailGuard } from './providers/routing/can-deactivate-detail-guard';
import {
    AffixedInputComponent,
    AssetFileInputComponent,
    AssetGalleryComponent,
    AssetPickerDialogComponent,
    ChipComponent,
    ConfigurableInputComponent,
    CurrencyInputComponent,
    CurrencyNamePipe,
    CustomerLabelComponent,
    CustomFieldControlComponent,
    DataTableColumnComponent,
    DataTableComponent,
    DialogButtonsDirective,
    DialogComponentOutletComponent,
    DialogTitleDirective,
    DropdownComponent,
    DropdownItemDirective,
    DropdownMenuComponent,
    DropdownTriggerDirective,
    FacetValueChipComponent,
    FacetValueSelectorComponent,
    FileSizePipe,
    FormattedAddressComponent,
    FormFieldComponent,
    FormFieldControlDirective,
    FormItemComponent,
    ItemsPerPageControlsComponent,
    LabeledDataComponent,
    LanguageSelectorComponent,
    ModalDialogComponent,
    ObjectTreeComponent,
    OrderStateLabelComponent,
    PaginationControlsComponent,
    PercentageSuffixInputComponent,
    RichTextEditorComponent,
    SelectToggleComponent,
    SentenceCasePipe,
    SimpleDialogComponent,
    SortPipe,
    StringToColorPipe,
    TableRowActionComponent,
    TitleInputComponent,
} from './shared-declarations';

const IMPORTS = [
    ClarityModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgSelectModule,
    NgxPaginationModule,
    TranslateModule,
    OverlayModule,
];

const DECLARATIONS = [
    ActionBarComponent,
    ActionBarLeftComponent,
    ActionBarRightComponent,
    ConfigurableInputComponent,
    AffixedInputComponent,
    ChipComponent,
    CurrencyInputComponent,
    CurrencyNamePipe,
    CustomerLabelComponent,
    CustomFieldControlComponent,
    DataTableComponent,
    DataTableColumnComponent,
    FacetValueSelectorComponent,
    ItemsPerPageControlsComponent,
    PaginationControlsComponent,
    TableRowActionComponent,
    FacetValueChipComponent,
    FileSizePipe,
    FormFieldComponent,
    FormFieldControlDirective,
    FormItemComponent,
    ModalDialogComponent,
    PercentageSuffixInputComponent,
    DialogComponentOutletComponent,
    DialogButtonsDirective,
    DialogTitleDirective,
    SelectToggleComponent,
    LanguageSelectorComponent,
    RichTextEditorComponent,
    SimpleDialogComponent,
    TitleInputComponent,
    SentenceCasePipe,
    DropdownComponent,
    DropdownMenuComponent,
    SortPipe,
    DropdownTriggerDirective,
    DropdownItemDirective,
    OrderStateLabelComponent,
    FormattedAddressComponent,
    LabeledDataComponent,
    StringToColorPipe,
    ObjectTreeComponent,
    IfPermissionsDirective,
    HasPermissionPipe,
    ActionBarItemsComponent,
    DisabledDirective,
    AssetFileInputComponent,
    AssetGalleryComponent,
    AssetPickerDialogComponent,
];

@NgModule({
    imports: IMPORTS,
    exports: [...IMPORTS, ...DECLARATIONS],
    declarations: DECLARATIONS,
    providers: [
        // This needs to be shared, since lazy-loaded
        // modules have their own entryComponents which
        // are unknown to the CoreModule instance of ModalService.
        // See https://github.com/angular/angular/issues/14324#issuecomment-305650763
        ModalService,
        CanDeactivateDetailGuard,
    ],
    entryComponents: [ModalDialogComponent, SimpleDialogComponent, AssetPickerDialogComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SharedModule {}
