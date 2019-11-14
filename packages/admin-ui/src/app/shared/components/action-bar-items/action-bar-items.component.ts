import {
    ChangeDetectionStrategy,
    Component,
    HostBinding,
    Input,
    OnChanges,
    OnInit,
    SimpleChanges,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { assertNever } from 'shared/shared-utils';

import { ActionBarItem } from '../../../core/providers/nav-builder/nav-builder-types';
import { NavBuilderService } from '../../../core/providers/nav-builder/nav-builder.service';

@Component({
    selector: 'vdr-action-bar-items',
    templateUrl: './action-bar-items.component.html',
    styleUrls: ['./action-bar-items.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionBarItemsComponent implements OnInit, OnChanges {
    @HostBinding('attr.data-location-id')
    @Input()
    locationId: string;

    items$: Observable<ActionBarItem[]>;
    private locationId$ = new BehaviorSubject<string>('');

    constructor(private navBuilderService: NavBuilderService, private route: ActivatedRoute) {}

    ngOnInit() {
        this.items$ = combineLatest(this.navBuilderService.actionBarConfig$, this.locationId$).pipe(
            map(([items, locationId]) => items.filter(config => config.locationId === locationId)),
        );
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('locationId' in changes) {
            this.locationId$.next(changes['locationId'].currentValue);
        }
    }

    handleClick(event: MouseEvent, item: ActionBarItem) {
        if (typeof item.onClick === 'function') {
            item.onClick(event, this.route);
        }
    }

    getRouterLink(item: ActionBarItem): any[] | null {
        return this.navBuilderService.getRouterLink(item, this.route);
    }

    getButtonStyles(item: ActionBarItem): string[] {
        const styles = ['btn'];
        if (item.buttonStyle && item.buttonStyle === 'link') {
            styles.push('btn-link');
            return styles;
        }
        styles.push(this.getButtonColorClass(item));
        return styles;
    }

    private getButtonColorClass(item: ActionBarItem): string {
        switch (item.buttonColor) {
            case undefined:
            case 'primary':
                return item.buttonStyle === 'outline' ? 'btn-outline' : 'btn-primary';
            case 'success':
                return item.buttonStyle === 'outline' ? 'btn-success-outline' : 'btn-success';
            case 'warning':
                return item.buttonStyle === 'outline' ? 'btn-warning-outline' : 'btn-warning';
            default:
                assertNever(item.buttonColor);
                return '';
        }
    }
}
