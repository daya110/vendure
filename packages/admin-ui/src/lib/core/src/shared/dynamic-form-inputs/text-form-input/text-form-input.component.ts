import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DefaultFormComponentId } from '@vendure/common/lib/shared-types';

import { FormInputComponent, InputComponentConfig } from '../../../common/component-registry-types';

@Component({
    selector: 'vdr-text-form-input',
    templateUrl: './text-form-input.component.html',
    styleUrls: ['./text-form-input.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFormInputComponent implements FormInputComponent {
    static readonly id: DefaultFormComponentId = 'text-form-input';
    readonly: boolean;
    formControl: FormControl;
    config: InputComponentConfig;
}
