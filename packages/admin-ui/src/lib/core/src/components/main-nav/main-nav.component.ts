import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';
import { map, startWith } from 'rxjs/operators';

import { HealthCheckService } from '../../providers/health-check/health-check.service';
import { JobQueueService } from '../../providers/job-queue/job-queue.service';
import { NavMenuBadge, NavMenuItem } from '../../providers/nav-builder/nav-builder-types';
import { NavBuilderService } from '../../providers/nav-builder/nav-builder.service';

@Component({
    selector: 'vdr-main-nav',
    templateUrl: './main-nav.component.html',
    styleUrls: ['./main-nav.component.scss'],
})
export class MainNavComponent implements OnInit {
    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public navBuilderService: NavBuilderService,
        private healthCheckService: HealthCheckService,
        private jobQueueService: JobQueueService,
    ) {}

    ngOnInit(): void {
        this.navBuilderService.defineNavMenuSections([
            {
                requiresPermission: 'ReadCatalog',
                id: 'catalog',
                label: _('nav.catalog'),
                items: [
                    {
                        id: 'products',
                        label: _('nav.products'),
                        icon: 'library',
                        routerLink: ['/catalog', 'products'],
                    },
                    {
                        id: 'facets',
                        label: _('nav.facets'),
                        icon: 'tag',
                        routerLink: ['/catalog', 'facets'],
                    },
                    {
                        id: 'collections',
                        label: _('nav.collections'),
                        icon: 'folder-open',
                        routerLink: ['/catalog', 'collections'],
                    },
                    {
                        id: 'assets',
                        label: _('nav.assets'),
                        icon: 'image-gallery',
                        routerLink: ['/catalog', 'assets'],
                    },
                ],
            },
            {
                id: 'sales',
                label: _('nav.sales'),
                requiresPermission: 'ReadOrder',
                items: [
                    {
                        id: 'orders',
                        label: _('nav.orders'),
                        routerLink: ['/orders'],
                        icon: 'shopping-cart',
                    },
                ],
            },
            {
                id: 'customers',
                label: _('nav.customers'),
                requiresPermission: 'ReadCustomer',
                items: [
                    {
                        id: 'customers',
                        label: _('nav.customers'),
                        routerLink: ['/customer', 'customers'],
                        icon: 'user',
                    },
                    {
                        id: 'customer-groups',
                        label: _('nav.customer-groups'),
                        routerLink: ['/customer', 'groups'],
                        icon: 'users',
                    },
                ],
            },
            {
                id: 'marketing',
                label: _('nav.marketing'),
                requiresPermission: 'ReadPromotion',
                items: [
                    {
                        id: 'promotions',
                        label: _('nav.promotions'),
                        routerLink: ['/marketing', 'promotions'],
                        icon: 'asterisk',
                    },
                ],
            },
            {
                id: 'settings',
                label: _('nav.settings'),
                requiresPermission: 'ReadSettings',
                collapsible: true,
                collapsedByDefault: true,
                items: [
                    {
                        id: 'channels',
                        label: _('nav.channels'),
                        routerLink: ['/settings', 'channels'],
                        icon: 'layers',
                    },
                    {
                        id: 'administrators',
                        label: _('nav.administrators'),
                        requiresPermission: 'ReadAdministrator',
                        routerLink: ['/settings', 'administrators'],
                        icon: 'administrator',
                    },
                    {
                        id: 'roles',
                        label: _('nav.roles'),
                        requiresPermission: 'ReadAdministrator',
                        routerLink: ['/settings', 'roles'],
                        icon: 'users',
                    },
                    {
                        id: 'shipping-methods',
                        label: _('nav.shipping-methods'),
                        routerLink: ['/settings', 'shipping-methods'],
                        icon: 'truck',
                    },
                    {
                        id: 'payment-methods',
                        label: _('nav.payment-methods'),
                        routerLink: ['/settings', 'payment-methods'],
                        icon: 'credit-card',
                    },
                    {
                        id: 'tax-categories',
                        label: _('nav.tax-categories'),
                        routerLink: ['/settings', 'tax-categories'],
                        icon: 'view-list',
                    },
                    {
                        id: 'tax-rates',
                        label: _('nav.tax-rates'),
                        routerLink: ['/settings', 'tax-rates'],
                        icon: 'calculator',
                    },
                    {
                        id: 'countries',
                        label: _('nav.countries'),
                        routerLink: ['/settings', 'countries'],
                        icon: 'flag',
                    },
                    {
                        id: 'zones',
                        label: _('nav.zones'),
                        routerLink: ['/settings', 'zones'],
                        icon: 'world',
                    },
                    {
                        id: 'global-settings',
                        label: _('nav.global-settings'),
                        routerLink: ['/settings', 'global-settings'],
                        icon: 'cog',
                    },
                ],
            },
            {
                id: 'system',
                label: _('nav.system'),
                requiresPermission: 'ReadSettings',
                collapsible: true,
                collapsedByDefault: true,
                items: [
                    {
                        id: 'job-queue',
                        label: _('nav.job-queue'),
                        routerLink: ['/system', 'jobs'],
                        icon: 'tick-chart',
                        statusBadge: this.jobQueueService.activeJobs$.pipe(
                            startWith([]),
                            map(
                                (jobs) =>
                                    ({
                                        type: jobs.length === 0 ? 'none' : 'info',
                                        propagateToSection: jobs.length > 0,
                                    } as NavMenuBadge),
                            ),
                        ),
                    },
                    {
                        id: 'system-status',
                        label: _('nav.system-status'),
                        routerLink: ['/system', 'system-status'],
                        icon: 'rack-server',
                        statusBadge: this.healthCheckService.status$.pipe(
                            map((status) => ({
                                type: status === 'ok' ? 'success' : 'error',
                                propagateToSection: status === 'error',
                            })),
                        ),
                    },
                ],
            },
        ]);
    }

    getRouterLink(item: NavMenuItem) {
        return this.navBuilderService.getRouterLink(item, this.route);
    }
}
